// src/components/ErrorBoundary.tsx (functional with lib)
import React, { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import { View, Text, Button } from 'react-native';
import { useData } from '@/hooks/use-data';

 export const FallbackComponent = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  const { clearError } = useData(); // Global clear

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Something went wrong!</Text>
      <Text style={{ fontSize: 14, color: 'gray', marginBottom: 20 }}>{error.message}</Text>
      <Button title="Retry" onPress={() => { resetErrorBoundary(); clearError(); }} />
    </View>
  );
};

