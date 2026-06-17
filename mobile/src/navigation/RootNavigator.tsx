import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useAuth } from '../contexts/AuthContext'
import { ActivityIndicator, View, StyleSheet } from 'react-native'

import LandingScreen from '../screens/auth/LandingScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import OrderTrackingScreen from '../screens/OrderTrackingScreen'
import AppTabs from './AppTabs'
import ChatScreen from '../screens/ChatScreen'

import AdminPortalScreen from '../screens/admin/AdminPortalScreen'
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen'
import AdminUsersScreen from '../screens/admin/AdminUsersScreen'
import AdminMenuScreen from '../screens/admin/AdminMenuScreen'
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen'

export type RootStackParamList = {
  Landing: undefined
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  App: undefined
  OrderTracking: { orderId: string }
  Chat: { orderId: string; interlocutorName?: string; interlocutorRole?: string }
  AdminPortal: undefined
  AdminDashboard: undefined
  AdminUsers: undefined
  AdminMenu: undefined
  AdminOrders: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="App" component={AppTabs} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="AdminPortal" component={AdminPortalScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminMenu" component={AdminMenuScreen} />
            <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0f14',
  },
})
