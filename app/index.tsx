import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

// Initialize MapLibre for React Native
MapLibreGL.setAccessToken('');

export default function HomeScreen() {
  const [location, setLocation] = React.useState<MapLibreGL.Location | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GritMap - Segment Tracker</Text>
      <View style={styles.mapContainer}>
        <MapLibreGL.MapView
          style={styles.map}
          styleURL="https://demotiles.maplibre.org/style.json"
          centerCoordinate={[-74.5, 40]}
          zoomLevel={9}
          onDidFinishLoadingStyle={() => {
            console.log('Map style loaded');
          }}
        >
          <MapLibreGL.Camera
            zoomLevel={9}
            centerCoordinate={[-74.5, 40]}
            animationMode="none"
          />

          {/* Simple point annotation to show the map is working */}
          <MapLibreGL.PointAnnotation
            key="point-annotation"
            id="point-annotation"
            coordinate={[-74.5, 40]}
          >
            <View style={styles.marker} />
          </MapLibreGL.PointAnnotation>
        </MapLibreGL.MapView>
      </View>
      <Text style={styles.info}>OpenStreetMap Vector Tiles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff0000',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  info: {
    fontSize: 12,
    color: '#666',
    padding: 8,
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
  },
});
