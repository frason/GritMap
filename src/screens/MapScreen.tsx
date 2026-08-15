import React from 'react';
import { StyleSheet } from 'react-native';
import { Map } from '@maplibre/maplibre-react-native';

export default function MapScreen() {
  return (
    <Map
      style={styles.map}
      mapStyle="https://demotiles.maplibre.org/style.json"
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
