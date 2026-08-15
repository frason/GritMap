import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { bootstrapDatabase } from './src/db/bootstrap';

export default function App() {
  useEffect(() => {
    try {
      bootstrapDatabase();
    } catch (error) {
      // Surfaced for local/dev-build debugging; #5 owns user-facing error
      // handling for import/persistence failures.
      console.error('Failed to bootstrap the on-device database', error);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
