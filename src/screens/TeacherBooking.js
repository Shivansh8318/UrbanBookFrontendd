import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import ReconnectingWebSocket from 'react-native-reconnecting-websocket';

const { width, height } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const TeacherBooking = ({ route, navigation }) => {
  const { userData } = route.params || {};
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [upcomingSlots, setUpcomingSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const websocket = new ReconnectingWebSocket(`wss://3caa-110-235-239-151.ngrok-free.app/ws/booking/${userData.user_id}/`);
    setWs(websocket);

    websocket.onopen = () => console.log('WebSocket Connected');
    websocket.onmessage = (e) => {
      console.log('WebSocket Message Received:', e.data); // Debug log
      const data = JSON.parse(e.data);
      if (data.type === 'slot_update' || data.type === 'booking_update') {
        console.log('Fetching slots due to update:', data.type); // Debug log
        fetchSlots();
      } else if (data.type === 'error') {
        console.log('WebSocket Error:', data.message); // Debug log
        Alert.alert('Error', data.message);
      }
    };
    websocket.onerror = (e) => {
      console.error('WebSocket Error:', e);
      Alert.alert('Connection Error', 'Failed to connect to real-time updates.');
    };
    websocket.onclose = () => console.log('WebSocket Disconnected');

    return () => websocket.close();
  }, [userData.user_id]);

  useEffect(() => {
    fetchSlots();
  }, [userData]);

  const fetchSlots = async () => {
    try {
      const response = await fetch('https://3caa-110-235-239-151.ngrok-free.app/api/booking/get-teacher-slots/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: userData.user_id }),
      });
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching slots:', data.error);
        setUpcomingSlots([]);
        setBookedSlots([]);
        Alert.alert('Error', data.error);
      } else {
        console.log('Fetched slots:', data); // Debug log
        setUpcomingSlots(data.filter(slot => !slot.is_booked));
        setBookedSlots(data.filter(slot => slot.is_booked));
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      setUpcomingSlots([]);
      setBookedSlots([]);
      Alert.alert('Error', 'Failed to fetch slots');
    }
  };

  const handleAddSlot = () => {
    if (!date || !startTime || !endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        action: 'add_slot',
        teacher_id: userData.user_id,
        date,
        start_time: startTime,
        end_time: endTime,
      }));
      setDate('');
      setStartTime('');
      setEndTime('');
    }
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    return (
      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
            <Text style={styles.calendarNav}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
            <Text style={styles.calendarNav}>Next</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <Text key={index} style={styles.calendarDay}>{day}</Text>
          ))}
          {emptyDays.map((_, index) => (
            <View key={`empty-${index}`} style={styles.calendarDate}></View>
          ))}
          {days.map((day) => (
            <TouchableOpacity
              key={day}
              style={styles.calendarDate}
              onPress={() => setDate(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
            >
              <Text>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../assets/images/9.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
        entering={FadeIn.duration(1000)}
      />

      <View style={styles.overlay} />

      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.55)']}
        style={StyleSheet.absoluteFill}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View style={styles.header} entering={FadeIn.delay(100).duration(500)}>
              <Text style={styles.title}>Manage Slots</Text>
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(200).duration(500)}
            >
              <Text style={styles.sectionTitle}>Add New Slot</Text>
              <View style={styles.calendarContainer}>
                {renderCalendar()}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={date}
                onChangeText={setDate}
                editable={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Start Time (HH:MM)"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={startTime}
                onChangeText={setStartTime}
              />
              <TextInput
                style={styles.input}
                placeholder="End Time (HH:MM)"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={endTime}
                onChangeText={setEndTime}
              />
              <AnimatedTouchableOpacity 
                style={styles.addButton} 
                onPress={handleAddSlot}
                entering={FadeInUp.delay(300).duration(500)}
              >
                <Text style={styles.addButtonText}>Add Slot</Text>
              </AnimatedTouchableOpacity>
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(400).duration(500)}
            >
              <Text style={styles.sectionTitle}>Upcoming Slots</Text>
              {upcomingSlots.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming slots.</Text>
              ) : (
                <FlatList
                  data={upcomingSlots}
                  renderItem={({ item }) => (
                    <View style={styles.slotCard}>
                      <Text style={styles.slotText}>{item.date} {item.start_time} - {item.end_time}</Text>
                    </View>
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  nestedScrollEnabled={true}
                  style={styles.flatListContainer}
                />
              )}
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(500).duration(500)}
            >
              <Text style={styles.sectionTitle}>Booked Slots</Text>
              {bookedSlots.length === 0 ? (
                <Text style={styles.emptyText}>No booked slots.</Text>
              ) : (
                <FlatList
                  data={bookedSlots}
                  renderItem={({ item }) => (
                    <View style={styles.slotCard}>
                      <Text style={styles.slotText}>{item.date} {item.start_time} - {item.end_time}</Text>
                      {item.status && <Text style={styles.statusText}>Status: {item.status}</Text>}
                    </View>
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  nestedScrollEnabled={true}
                  style={styles.flatListContainer}
                />
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#111827' 
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  safeArea: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 20,
    paddingTop: height * 0.05, 
  },
  header: { 
    marginBottom: 20 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 8,
    textAlign: 'center',
  },
  section: { 
    marginBottom: 20 
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 10 
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  input: { 
    height: 45, 
    borderColor: 'rgba(255, 255, 255, 0.3)', 
    borderWidth: 1, 
    borderRadius: 8, 
    marginBottom: 12, 
    paddingHorizontal: 12,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  addButton: { 
    backgroundColor: 'rgba(147, 51, 234, 0.8)', 
    padding: 16, 
    borderRadius: 9999, 
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  addButtonText: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  slotCard: { 
    padding: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 12, 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', 
  },
  slotText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  calendarContainer: {
    marginBottom: 15,
  },
  calendar: { 
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  calendarHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  calendarNav: { 
    fontSize: 16, 
    color: '#A855F7' 
  },
  calendarTitle: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap' 
  },
  calendarDay: { 
    width: '14.28%', 
    textAlign: 'center', 
    fontWeight: 'bold', 
    marginBottom: 5,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  calendarDate: { 
    width: '14.28%', 
    padding: 10, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.2)' 
  },
  flatListContainer: {
    maxHeight: 250,
  },
});

export default TeacherBooking;