import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttons?: AlertButton[];
  duration?: number;
}

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const ALERT_CONFIGS = {
  success: { icon: 'check-circle', backgroundColor: '#ECFDF5', iconColor: '#10B981' },
  error: { icon: 'error', backgroundColor: '#FEF2F2', iconColor: '#EF4444' },
  warning: { icon: 'warning', backgroundColor: '#FFFBEB', iconColor: '#F59E0B' },
  info: { icon: 'info', backgroundColor: '#EFF6FF', iconColor: '#3B82F6' },
} as const;

const DEFAULT_BUTTONS: Record<string, AlertButton[]> = {
  success: [{ text: 'Got it', style: 'default' }],
  error: [{ text: 'Try Again', style: 'default' }],
  warning: [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'default' }
  ],
  info: [{ text: 'OK', style: 'default' }],
};

// Mutable state object — mutations happen in-place, listener set is never replaced
interface AlertState {
  visible: boolean;
  options: AlertOptions | null;
  listeners: Set<() => void>;
}

function notifyListeners(state: AlertState) {
  state.listeners.forEach(fn => fn());
}

function showAlertState(state: AlertState, options: AlertOptions) {
  state.visible = true;
  state.options = options;
  notifyListeners(state);
}

function hideAlertState(state: AlertState) {
  state.visible = false;
  state.options = null;
  notifyListeners(state);
}

// Web overlay — reads from mutable state, renders inline (no createPortal)
function WebAlertOverlay({ state }: { state: AlertState }) {
  const [, forceUpdate] = useState(0);

  React.useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    state.listeners.add(listener);
    return () => { state.listeners.delete(listener); };
  }, [state]);

  if (!state.visible || !state.options) return null;

  const options = state.options;
  const config = ALERT_CONFIGS[options.type || 'info'];
  const buttons = options.buttons || DEFAULT_BUTTONS[options.type || 'info'] || DEFAULT_BUTTONS.info;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 99999, padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) hideAlertState(state); }}
    >
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 400,
        minWidth: 300, position: 'relative', overflow: 'hidden',
        boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.15)',
      }}>
        <button
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1, width: 32, height: 32,
            borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            cursor: 'pointer', border: 'none', padding: 0,
          }}
          onClick={() => hideAlertState(state)}
          aria-label="Close"
        >
          <MaterialIcons name="close" size={24} color="#6B7280" />
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 16px' }}>
          <div style={{
            width: 88, height: 88, borderRadius: 44, backgroundColor: config.backgroundColor,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}>
            <MaterialIcons name={config.icon as never} size={48} color={config.iconColor} />
          </div>
        </div>

        {options.title && (
          <div style={{
            fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center',
            marginBottom: 8, padding: '0 32px', fontFamily: 'Inter, system-ui, sans-serif',
          }}>{options.title}</div>
        )}

        <div style={{
          fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: '24px',
          padding: '0 32px', marginBottom: 32, fontFamily: 'Inter, system-ui, sans-serif',
        }}>{options.message}</div>

        <div style={{ display: 'flex', gap: 12, padding: '0 32px 32px' }}>
          {buttons.map((button, index) => {
            const isCancel = button.style === 'cancel';
            const isDestructive = button.style === 'destructive';
            return (
              <button
                key={index}
                style={{
                  flex: 1, padding: '16px 0', borderRadius: 12, border: 'none',
                  fontSize: 16, fontWeight: '600', cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundColor: isCancel ? '#F3F4F6' : isDestructive ? '#FEE2E2' : Colors.light.primary,
                  color: isCancel ? '#6B7280' : isDestructive ? '#DC2626' : '#FFFFFF',
                }}
                onClick={() => {
                  if (button.onPress) button.onPress();
                  hideAlertState(state);
                }}
              >
                {button.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Native fallback — uses React Native Modal
function NativeAlertOverlay({ state }: { state: AlertState }) {
  const [, forceUpdate] = useState(0);

  React.useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    state.listeners.add(listener);
    return () => { state.listeners.delete(listener); };
  }, [state]);

  if (!state.visible || !state.options) return null;

  const options = state.options;
  const config = ALERT_CONFIGS[options.type || 'info'];
  const buttons = options.buttons || DEFAULT_BUTTONS[options.type || 'info'] || DEFAULT_BUTTONS.info;

  const handleClose = () => hideAlertState(state);

  return (
    <View style={nativeStyles.overlay}>
      <View style={nativeStyles.dialog}>
        <View style={[nativeStyles.iconContainer, { backgroundColor: config.backgroundColor }]}>
          <MaterialIcons name={config.icon as never} size={32} color={config.iconColor} />
        </View>

        {options.title && (
          <Text style={nativeStyles.title}>{options.title}</Text>
        )}

        <Text style={nativeStyles.message}>{options.message}</Text>

        <View style={nativeStyles.buttonContainer}>
          {buttons.map((button, index) => {
            const isCancel = button.style === 'cancel';
            const isDestructive = button.style === 'destructive';
            return (
              <TouchableOpacity
                key={index}
                style={[
                  nativeStyles.button,
                  isCancel && nativeStyles.cancelButton,
                  isDestructive && nativeStyles.destructiveButton,
                ]}
                onPress={() => {
                  if (button.onPress) button.onPress();
                  handleClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  nativeStyles.buttonText,
                  isCancel && nativeStyles.cancelButtonText,
                  isDestructive && nativeStyles.destructiveButtonText,
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    padding: 24,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    minWidth: 300,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  destructiveButton: {
    backgroundColor: '#FEE2E2',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButtonText: {
    color: '#6B7280',
  },
  destructiveButtonText: {
    color: '#DC2626',
  },
});

export function AlertProvider({ children }: { children: ReactNode }) {
  // Mutable state object — AlertProvider NEVER re-renders children when alert changes
  const stateRef = useRef<AlertState>({
    visible: false,
    options: null,
    listeners: new Set(),
  });

  const showAlert = useCallback((options: AlertOptions) => {
    showAlertState(stateRef.current, options);
  }, []);

  const hideAlert = useCallback(() => {
    hideAlertState(stateRef.current);
  }, []);

  const contextValue = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      {/* Single overlay — web uses inline div, native uses RN Modal */}
      {Platform.OS === 'web' ? (
        <WebAlertOverlay state={stateRef.current} />
      ) : (
        <NativeAlertOverlay state={stateRef.current} />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
