import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors } from '@/constants';
import { useSearch } from '@/hooks/useSearch';

const SearchTestComponent: React.FC = () => {
  const [testLang] = useState('en');
  const { query, setQuery, searchResults, isSearching, clearSearch } =
    useSearch(testLang);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Test Component</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for addresses..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {query.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {isSearching && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      <ScrollView style={styles.resultsContainer}>
        {searchResults && searchResults.length > 0 ? (
          searchResults.map((result, index) => (
            <View key={`${result.id}-${index}`} style={styles.resultItem}>
              <Text style={styles.resultTitle}>
                {result.businessName || 'Address'}
              </Text>
              <Text style={styles.resultAddress}>
                {result.formattedAddress}
              </Text>
              <Text style={styles.resultCoords}>
                {result.latitude}, {result.longitude}
              </Text>
              <Text style={styles.resultType}>
                Type: {result.type || 'unknown'}
              </Text>
            </View>
          ))
        ) : query.length > 0 && !isSearching ? (
          <Text style={styles.noResultsText}>No results found</Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.light['0'],
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark['0'],
    marginBottom: 20,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.grey,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: Colors.light['0'],
  },
  clearButton: {
    marginLeft: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: Colors.error,
    borderRadius: 8,
  },
  clearButtonText: {
    color: Colors.light['0'],
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.primary['500'],
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: Colors.light.grey,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark['0'],
    marginBottom: 5,
  },
  resultAddress: {
    fontSize: 14,
    color: Colors.dark['0'],
    marginBottom: 5,
  },
  resultCoords: {
    fontSize: 12,
    color: Colors.grey,
    marginBottom: 3,
  },
  resultType: {
    fontSize: 12,
    color: Colors.primary['500'],
    fontWeight: '500',
  },
  noResultsText: {
    fontSize: 16,
    color: Colors.grey,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default SearchTestComponent;
