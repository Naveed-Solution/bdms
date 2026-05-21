import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  title: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Card Component
 * Reusable card component for displaying content in a styled container
 */
export default function Card({ title, children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
});

