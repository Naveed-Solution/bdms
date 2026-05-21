import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  type?: 'success' | 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  type = 'info',
  onDismiss,
}: CustomAlertProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '!';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#DC143C';
      case 'error':
        return '#DC143C';
      case 'warning':
        return '#FF9800';
      case 'info':
      default:
        return '#DC143C';
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
            <Text style={styles.icon}>{getIcon()}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'cancel' && styles.buttonCancel,
                  button.style === 'destructive' && styles.buttonDestructive,
                  buttons.length === 1 && styles.buttonSingle,
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.buttonTextCancel,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    width: width - 80,
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    backgroundColor: '#DC143C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSingle: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonDestructive: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#666',
  },
  buttonTextDestructive: {
    color: '#fff',
  },
});

