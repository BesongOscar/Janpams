import { NavigationApp } from '@/components/NavigationOption';

export const routeNavigationApps: NavigationApp[] = [
  {
    id: 'apple-maps',
    name: 'Apple Maps',
    icon: '🍎',
    iconType: 'custom',
    color: '#007AFF',
    textColor: '#FFFFFF',
  },
  {
    id: 'jango',
    name: 'Jango',
    icon: 'J',
    iconType: 'custom',
    color: '#8B5CF6',
    textColor: '#FFFFFF',
  },
  {
    id: 'lyft',
    name: 'Lyft',
    icon: 'car',
    iconType: 'material',
    color: '#FF00BF',
    textColor: '#FFFFFF',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    icon: 'map',
    iconType: 'material',
    color: '#4285F4',
    textColor: '#FFFFFF',
  },
  {
    id: 'mapsme',
    name: 'Maps.me',
    icon: 'map',
    iconType: 'material',
    color: '#2781E0',
    textColor: '#FFFFFF',
  },
  {
    id: 'here',
    name: 'HERE',
    icon: 'map-marker',
    iconType: 'material',
    color: '#00D4AA',
    textColor: '#FFFFFF',
  },
  {
    id: 'uber',
    name: 'Uber',
    icon: 'car',
    iconType: 'material',
    color: '#000000',
    textColor: '#FFFFFF',
  },
  {
    id: 'waze',
    name: 'Waze',
    icon: 'navigation',
    iconType: 'material',
    color: '#33CCFF',
    textColor: '#FFFFFF',
  },
];

export const getRouteNavigationAppById = (
  id: string,
): NavigationApp | undefined => {
  return routeNavigationApps.find(app => app.id === id);
};
