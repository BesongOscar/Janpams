import { StreetType } from '@/interfaces';
import Colors from './Colors';
import countries from './countries.json';
import streetAppelations from './streetAppelations.json';
import unitTypes from './unitTypes.json';
import connections from './connections.json';
import region_zip from './region-zip.json';
import { addressCategories } from './addressCategories';
import { navigationApps, getNavigationAppById } from './navigationApps';
import {
  routeNavigationApps,
  getRouteNavigationAppById,
} from './routeNavigationApps';

countries.sort((a, b) => a.name.localeCompare(b.name));

const CAMEROON = countries.find(country => country.name === 'Cameroon');

const STREET_TYPES: StreetType[] = streetAppelations;
const UNIT_TYPES: StreetType[] = unitTypes;
const CONNECTIONS: StreetType[] = connections;

const RegionZip = region_zip;

export { grayMapStyle } from './mapStyles';
export { MAP_TILE_CONFIG, OSM_TILE_SERVERS, PLUS_CODE_GRID_TILE_URL } from './mapTiles';

export {
  Colors,
  CAMEROON,
  countries,
  STREET_TYPES,
  UNIT_TYPES,
  CONNECTIONS,
  RegionZip,
  addressCategories,
  navigationApps,
  getNavigationAppById,
  routeNavigationApps,
  getRouteNavigationAppById,
};
