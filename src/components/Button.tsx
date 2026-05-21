import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

/**
 * Button Component
 * Reusable button with primary and secondary variants
 */
export default function Button({ title, onPress, variant = 'primary', style }: ButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        variant === 'secondary' && styles.secondaryButton,
        style
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.buttonText,
        variant === 'secondary' && styles.secondaryButtonText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#DC143C',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  secondaryButtonText: {
    color: '#DC143C',
  },
});

