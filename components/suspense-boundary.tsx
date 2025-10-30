import React , {ReactNode, Suspense} from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface Props{
    children:ReactNode;
    fallbackText?:string;
}

export default function SuspenseBoundary({children, fallbackText="Loading..."}:Props){
    return(
        <Suspense
        fallback={
            <View style={styles.fallbackContainer}>
                <ActivityIndicator animating size="large"/>
                <Text style={styles.fallbackText}>{fallbackText}</Text>
            </View>
        }
        >
            {children}
        </Suspense>
    )
}

const styles=StyleSheet.create({
    fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // Or match your theme
  },
  fallbackText: {
    marginTop: 10,
    fontSize: 16,
  },
})