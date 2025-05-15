import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/WelcomeScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import AuthScreen from '../screens/AuthScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import StudentDashboard from '../screens/StudentDashboard';
import TeacherDashboard from '../screens/TeacherDashboard';
import StudentBooking from '../screens/StudentBooking';
import TeacherBooking from '../screens/TeacherBooking';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="CompleteProfileScreen" component={CompleteProfileScreen} />
        <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
        <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
        <Stack.Screen name="StudentBooking" component={StudentBooking} />
        <Stack.Screen name="TeacherBooking" component={TeacherBooking} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;