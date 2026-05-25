import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Icon, ProgressBar } from 'react-native-paper';
import { Colors } from '@/constants';
import { StatsCard } from './StatsCard';
import { DownloadedPackItem } from './DownloadedPackItem';
import { RegionItem } from './RegionItem';
import { initDB, checkAndRepairDB } from '@/lib/db';
import { getPackStats, getInstalledPacks, updatePack, uninstallPack, installPack } from '@/lib/dataPacks/manager';
import { getPackState } from '@/lib/japaState';
import { getAvailableDataPacks, downloadDataPack } from '@/lib/dataPacks/downloader';
import { snackbarToast } from '@/utils/toastHelpter';
import type { DataPackManifest } from '@/lib/db/schemas';
import type { PackState } from '@/lib/db/schemas';
import i18n from '../../i18n';
import type { DataPackInfo } from '@/lib/dataPacks/downloader';

interface CountryConfig {
  code: string;
  name: string;
  regions: Record<string, { name: string; cities: string[] }>;
}

const COUNTRIES: Record<string, CountryConfig> = {
  CM: {
    code: 'CM',
    name: 'Cameroon',
    regions: {
      'CM-SW': { name: 'South-West', cities: ['Buea', 'Limbe', 'Kumba', 'Tiko'] },
      'CM-LT': { name: 'Littoral', cities: ['Douala', 'Edea', 'Nkongsamba'] },
      'CM-CE': { name: 'Centre', cities: ['Yaoundé', 'Mbalmayo', 'Obala'] },
      'CM-OU': { name: 'West', cities: ['Bafoussam', 'Dschang', 'Mbouda'] },
      'CM-NW': { name: 'North-West', cities: ['Bamenda', 'Wum', 'Fundong'] },
      'CM-SU': { name: 'South', cities: ['Ebolowa', 'Kribi', 'Sangmelima'] },
      'CM-ES': { name: 'East', cities: ['Bertoua', 'Batouri', 'Yokadouma'] },
      'CM-AD': { name: 'Adamawa', cities: ['Ngaoundéré', 'Meiganga', 'Tibati'] },
      'CM-NO': { name: 'North', cities: ['Garoua', 'Guider', 'Poli'] },
      'CM-EN': { name: 'Far North', cities: ['Maroua', 'Kousseri', 'Mokolo'] },
    },
  },
};

interface OfflineDataManagerProps {
  onClose: () => void;
}

export const OfflineDataManager: React.FC<OfflineDataManagerProps> = ({
  onClose,
}) => {
  const [stats, setStats] = useState<{
    streetCount: number;
    boundaryCount: number;
    settlementCount: number;
    routeCount: number;
    packCount: number;
  } | null>(null);
  const [downloadedPacks, setDownloadedPacks] = useState<DataPackManifest[]>([]);
  const [cloudPacks, setCloudPacks] = useState<DataPackInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingRegion, setDownloadingRegion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [packStateByRegion, setPackStateByRegion] = useState<Record<string, PackState>>({});
  const [selectedCountry, setSelectedCountry] = useState<string>('CM');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const countryConfig = COUNTRIES[selectedCountry];

  const regionColWidth = useMemo(() => {
    const sectionPadding = 24;
    const gapBetweenCols = 8;
    return (windowWidth - sectionPadding - gapBetweenCols * 2) / 3;
  }, [windowWidth]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // Initialize DB and ensure it's healthy (like web's getDB() guarantees)
      await initDB();

      // Check and repair DB if needed (ensures all tables exist)
      const dbHealthy = await checkAndRepairDB();

      if (!dbHealthy) {
        console.log('[OfflineDataManager] Database was repaired, retrying data load...');
      }

      // Fetch stats and packs (with defensive error handling)
      const [newStats, packs] = await Promise.all([
        getPackStats().catch(error => {
          console.log('[OfflineDataManager] Error fetching pack stats:', error);
          // Return zero stats on error (graceful degradation)
          return {
            streetCount: 0,
            boundaryCount: 0,
            settlementCount: 0,
            routeCount: 0,
            packCount: 0,
          };
        }),
        getInstalledPacks().catch(error => {
          console.log('[OfflineDataManager] Error fetching installed packs:', error);
          // Return empty array on error
          return [];
        }),
      ]);

      console.log('[OfflineDataManager] Loaded offline data stats and packs:', {
        stats: newStats,
        downloadedPackCount: packs.length,
      });

      setStats(newStats);
      setDownloadedPacks(packs);

      // Load pack state per region (JAPA Phase 2)
      const regions = COUNTRIES[selectedCountry]?.regions || {};
      const regionCodes = Object.keys(regions);
      const states = await Promise.all(regionCodes.map(code => getPackState(code).catch(() => 'NOT_INSTALLED' as PackState)));
      setPackStateByRegion(Object.fromEntries(regionCodes.map((code, i) => [code, states[i]])));

      // Fetch available packs from VPS (non-blocking - don't fail if offline)
      try {
        const available = await getAvailableDataPacks(selectedCountry);
        setCloudPacks(available);
      } catch (error) {
        console.warn('[OfflineDataManager] Could not fetch packs from VPS (offline?):', error);
        // Don't show error toast for VPS fetch failures - user might be offline
        // Just log and continue with local data
      }
    } catch (error) {
      console.log('[OfflineDataManager] Failed to load offline data (outer catch):', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Only show error if it's a critical DB issue, not VPS connectivity
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table') || errorMessage.includes('database')) {
        snackbarToast(
          'Database error. Please restart the app.',
          'error',
          Colors.error,
        );
      } else {
        snackbarToast(
          'Failed to load offline data. Check your connection.',
          'error',
          Colors.error,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedCountry]);

  const handleDownloadRegion = async (regionCode: string, forceRefresh = false) => {
    setDownloadingRegion(regionCode);
    setDownloadProgress(0);
    try {
      await initDB();
      if (forceRefresh) {
        await updatePack(regionCode, setDownloadProgress);
      } else {
        await installPack(regionCode, setDownloadProgress);
      }
      const action = forceRefresh ? 'updated' : 'downloaded';
      snackbarToast(
        `${countryConfig?.regions[regionCode]?.name || regionCode} data ${action} for offline use!`,
        'success',
        Colors.success,
      );
      await refreshData();
    } catch (error) {
      console.log('Failed to download region:', error);
      snackbarToast(
        error instanceof Error ? error.message : 'Failed to download region data',
        'error',
        Colors.error,
      );
      await refreshData(); // Refresh so FAILED state is shown
    } finally {
      setDownloadingRegion(null);
      setDownloadProgress(0);
    }
  };

  const handleDeleteRegion = async (regionCode: string) => {
    Alert.alert(
      'Delete Region Data',
      `Are you sure you want to delete ${countryConfig?.regions[regionCode]?.name || regionCode} data?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await initDB();
              await uninstallPack(regionCode);
              snackbarToast('Region data deleted', 'success', Colors.success);
              await refreshData();
            } catch (error) {
              console.log('Failed to delete region:', error);
              snackbarToast('Failed to delete region data', 'error', Colors.error);
            }
          },
        },
      ],
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Offline Data',
      'This will delete ALL offline data and require re-downloading. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await initDB();
              // Delete all packs
              for (const pack of downloadedPacks) {
                await uninstallPack(pack.id);
              }
              snackbarToast('All offline data cleared', 'success', Colors.success);
              await refreshData();
            } catch (error) {
              console.log('Failed to clear all data:', error);
              snackbarToast('Failed to clear offline data', 'error', Colors.error);
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const isRegionDownloaded = (regionCode: string) => {
    return downloadedPacks.some(
      p => p.id === regionCode || p.region === regionCode,
    );
  };

  const getCloudPackInfo = (regionCode: string) => {
    return cloudPacks.find(p => p.region_code === regionCode);
  };

  const currentRegions = countryConfig?.regions || {};
  const regionQuery = regionSearchQuery.trim().toLowerCase();
  const filteredRegionEntries = regionQuery
    ? Object.entries(currentRegions).filter(([regionCode, region]) => {
        const nameMatch = region.name.toLowerCase().includes(regionQuery);
        const codeMatch = regionCode.toLowerCase().includes(regionQuery);
        const cityMatch = region.cities.some(c =>
          c.toLowerCase().includes(regionQuery),
        );
        return nameMatch || codeMatch || cityMatch;
      })
    : Object.entries(currentRegions);
  const totalRegionCount = Object.keys(currentRegions).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon source="database" size={24} color={Colors.primary[500]} />
            <Text style={styles.headerTitle}>
              {i18n.t('offlineDataManager.title')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Icon source="close" size={24} color={Colors.dark[10]} />
          </TouchableOpacity>
        </View>
        <Text style={styles.description}>
          {i18n.t('offlineDataManager.description')}
        </Text>
      </View>


      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Stats Overview - Always show, even with 0 values */}
          <View style={styles.statsContainer}>
            <StatsCard
              icon="road"
              value={stats?.streetCount || 0}
              label={i18n.t('offlineDataManager.stats.streets')}
            />
            <StatsCard
              icon="office-building"
              value={stats?.boundaryCount || 0}
              label={i18n.t('offlineDataManager.stats.bounds')}
            />
            <StatsCard
              icon="map-marker"
              value={stats?.settlementCount || 0}
              label={i18n.t('offlineDataManager.stats.places')}
            />
            <StatsCard
              icon="transit-connection-variant"
              value={stats?.routeCount || 0}
              label={i18n.t('offlineDataManager.stats.routes')}
            />
          </View>

          {/* Clear All Button - Show if there's any data */}
          {stats &&
            (stats.streetCount > 0 ||
              stats.boundaryCount > 0 ||
              stats.settlementCount > 0) && (
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={handleClearAllData}
                disabled={isClearing}>
                {isClearing ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Icon source="delete" size={20} color={Colors.error} />
                )}
                <Text style={styles.clearAllButtonText}>
                  {isClearing
                    ? i18n.t('offlineDataManager.clearing')
                    : i18n.t('offlineDataManager.clearAll')}
                </Text>
              </TouchableOpacity>
            )}

          {/* Country dropdown + search field */}
          <View style={styles.countrySearchRow}>
            <TouchableOpacity
              style={styles.countryPill}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.countryPillText}>
                {countryConfig?.name || selectedCountry}
              </Text>
              <Icon source="chevron-down" size={14} color={Colors.dark['0.6']} />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <View style={styles.searchIcon}>
                <Icon
                  source="magnify"
                  size={16}
                  color={Colors.grey}
                />
              </View>
              <TextInput
                placeholder={i18n.t('offlineDataManager.searchPlaceholder')}
                placeholderTextColor={Colors.grey}
                style={styles.searchInput}
                value={regionSearchQuery}
                onChangeText={setRegionSearchQuery}
              />
            </View>
          </View>

          {/* Downloaded Packs */}
          {downloadedPacks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon source="package" size={18} color={Colors.dark[10]} />
                <Text style={styles.sectionTitle}>
                  {i18n.t('offlineDataManager.downloadedPacks')}
                </Text>
              </View>
              {downloadedPacks.map(pack => (
                <DownloadedPackItem
                  key={pack.id}
                  pack={pack}
                  onUpdate={regionCode => handleDownloadRegion(regionCode, true)}
                  onDelete={handleDeleteRegion}
                />
              ))}
            </View>
          )}

          {/* Cameroon Regions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon source="map-marker" size={18} color={Colors.dark[10]} />
              
              
              <View style={styles.sectionSubtitleContainer}>
              <Text style={styles.sectionTitle}>
                {i18n.t('offlineDataManager.regionsTitle')}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {filteredRegionEntries.length}{' '}
                {i18n.t('offlineDataManager.of')}{' '}
                {totalRegionCount}
              </Text>
              </View>
            </View>

            {/* Region grid (3 columns) */}
            {filteredRegionEntries.length === 0 ? (
              <Text style={styles.emptySearchText}>
                {i18n.t('offlineDataManager.noRegionsMatch')}
              </Text>
            ) : (
            <FlatList
              data={filteredRegionEntries}
              keyExtractor={([regionCode]) => regionCode}
              numColumns={3}
              columnWrapperStyle={styles.regionRow}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const [regionCode, region] = item;
                const isDownloaded = isRegionDownloaded(regionCode);
                const isDownloading = downloadingRegion === regionCode;
                const packInfo = getCloudPackInfo(regionCode);
                const packState = packStateByRegion[regionCode];

                return (
                  <View style={[styles.regionCol, { width: regionColWidth }]}>
                    <RegionItem
                      regionCode={regionCode}
                      regionName={region.name}
                      cities={region.cities}
                      isDownloaded={isDownloaded}
                      isDownloading={isDownloading}
                      downloadProgress={downloadProgress}
                      packInfo={packInfo}
                      packState={packState}
                      onDownload={handleDownloadRegion}
                      onUpdate={code => handleDownloadRegion(code, true)}
                    />
                  </View>
                );
              }}
            />
            )}
          </View>
        </ScrollView>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCountryPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Country</Text>
            {Object.entries(COUNTRIES).map(([code, config]) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.modalOption,
                  selectedCountry === code && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCountry(code);
                  setRegionSearchQuery('');
                  setShowCountryPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedCountry === code && styles.modalOptionTextSelected,
                  ]}
                >
                  {config.name}
                </Text>
                {selectedCountry === code && (
                  <Icon source="check" size={18} color={Colors.primary[500]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light[10],
  },
  headerContainer: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  description: {
    fontSize: 12,
    color: Colors.grey,
    fontFamily: 'gentium',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  scrollView: {
    flex: 1,
    paddingBottom: 100
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    height: 80,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  clearAllButtonText: {
    fontSize: 14,
    color: Colors.error,
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  howItWorksBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  howItWorksTitle: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: Colors.primary[500],
    marginBottom: 4,
  },
  howItWorksText: {
    fontSize: 12,
    color: Colors.primary[500],
    fontFamily: 'gentium',
  },
  countrySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    backgroundColor: Colors.light[10],
  },
  countryPillText: {
    fontSize: 13,
    fontFamily: 'gentium',
    marginRight: 4,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    backgroundColor: Colors.light[10],
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'gentium',
    paddingVertical: 0,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
  regionRow: {
    justifyContent: 'flex-start',
  },
  regionCol: {
    marginHorizontal: 4,
    maxWidth: '31.33%',
  },
  sectionSubtitleContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    width: '90%',
  },
  emptySearchText: {
    fontSize: 13,
    color: Colors.grey,
    fontFamily: 'gentium',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.light[10],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '75%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: Colors.primary[50] || '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  modalOptionTextSelected: {
    fontWeight: '600',
    color: Colors.primary[500],
  },
});
