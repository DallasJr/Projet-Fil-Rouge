import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Platform, Text } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

import MenuScreen from '../screens/MenuScreen'
import OrderHistoryScreen from '../screens/OrderHistoryScreen'
import DelivererScreen from '../screens/DelivererScreen'
import ProfileScreen from '../screens/ProfileScreen'
import AdminPortalScreen from '../screens/admin/AdminPortalScreen'

export type AppTabsParamList = {
  Menu: undefined
  Orders: undefined
  Deliveries: undefined
  Profile: undefined
  AdminTab: undefined
}

const Tab = createBottomTabNavigator<AppTabsParamList>()

const TabIcon = ({ label, focused }: { label: string; focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
    {label === 'Menu' ? '🍽️' : label === 'Orders' ? '📦' : label === 'Deliveries' ? '🚴' : label === 'Profile' ? '👤' : '🛠️'}
  </Text>
)

export default function AppTabs() {
  const { isDeliverer, isAdmin } = useAuth()
  const showDeliveries = isDeliverer || isAdmin

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#151821',
          borderTopColor: 'rgba(255, 255, 255, 0.07)',
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 65,
        },
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          tabBarLabel: 'Menu',
          tabBarIcon: ({ focused }) => <TabIcon label="Menu" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderHistoryScreen}
        options={{
          tabBarLabel: 'Commandes',
          tabBarIcon: ({ focused }) => <TabIcon label="Orders" focused={focused} />,
        }}
      />
      {showDeliveries && (
        <Tab.Screen
          name="Deliveries"
          component={DelivererScreen}
          options={{
            tabBarLabel: 'Livraisons',
            tabBarIcon: ({ focused }) => <TabIcon label="Deliveries" focused={focused} />,
          }}
        />
      )}
      {isAdmin && (
        <Tab.Screen
          name="AdminTab"
          component={AdminPortalScreen}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ focused }) => <TabIcon label="AdminTab" focused={focused} />,
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

