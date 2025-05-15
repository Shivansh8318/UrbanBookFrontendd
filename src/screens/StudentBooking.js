import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  FlatList,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import ReconnectingWebSocket from 'react-native-reconnecting-websocket';

const { width, height } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const StudentBooking = ({ route, navigation }) => {
  const { userData } = route.params || {};
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedClasses, setBookedClasses] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ws, setWs] = useState(null);
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [allSlots, setAllSlots] = useState([]); // Store all future slots for the teacher

  useEffect(() => {
    const setupWebSocket = () => {
      const websocket = new ReconnectingWebSocket(
        `wss://3caa-110-235-239-151.ngrok-free.app/ws/booking/${userData.user_id}/`
      );
      setWs(websocket);

      websocket.onopen = () => console.log('WebSocket Connected');
      websocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'booking_update') {
          const bookedSlotId = data.booking.slot_id;
          // Immediately remove the booked slot from availableSlots and allSlots
          setAvailableSlots((prevSlots) => prevSlots.filter((slot) => slot.id !== bookedSlotId));
          setAllSlots((prevSlots) => prevSlots.filter((slot) => slot.id !== bookedSlotId));
          // Update booked classes and reset booking state
          setBookingSlotId(null);
          fetchBookedClasses();
          // Refetch slots to ensure consistency
          if (selectedTeacher) {
            fetchAllSlots(selectedTeacher.user_id);
            if (selectedDate) {
              fetchAvailableSlots(selectedTeacher.user_id, selectedDate);
            }
          }
        } else if (data.type === 'slot_update') {
          // Handle new slot addition
          const newSlot = data.slot;
          if (selectedTeacher && newSlot.teacher_id === selectedTeacher.user_id && !newSlot.is_booked) {
            // Update allSlots for calendar highlights
            setAllSlots((prevSlots) => {
              if (prevSlots.some((slot) => slot.id === newSlot.id)) {
                return prevSlots;
              }
              return [...prevSlots, newSlot];
            });
            // Update availableSlots only if the slot matches the selected date
            if (selectedDate && newSlot.date === selectedDate.toISOString().split('T')[0]) {
              setAvailableSlots((prevSlots) => {
                if (prevSlots.some((slot) => slot.id === newSlot.id)) {
                  return prevSlots;
                }
                return [...prevSlots, newSlot];
              });
            }
          }
        } else if (data.type === 'error') {
          setBookingSlotId(null);
          Alert.alert('Booking Error', data.message);
        }
      };
      websocket.onerror = (e) => {
        console.error('WebSocket Error:', e);
        Alert.alert('Connection Error', 'Failed to connect to real-time updates. Some features may not work.');
      };
      websocket.onclose = () => console.log('WebSocket Disconnected');

      return () => websocket.close();
    };
    setupWebSocket();
  }, [userData.user_id]);

  useEffect(() => {
    fetchTeachers();
    fetchBookedClasses();
  }, [userData]);

  // Fetch all teachers
  const fetchTeachers = async () => {
    try {
      const response = await fetch(
        'https://3caa-110-235-239-151.ngrok-free.app/api/teacher/list-teachers/',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      console.log('Fetched teachers:', data); // Debug log
      setTeachers(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch teachers');
    }
  };

  // Fetch all future slots for the selected teacher
  const fetchAllSlots = async (teacherId) => {
    try {
      const response = await fetch(
        'https://3caa-110-235-239-151.ngrok-free.app/api/booking/get-teacher-slots/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teacher_id: teacherId,
          }),
        }
      );
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching all slots:', data.error);
        setAllSlots([]);
        Alert.alert('Error', data.error);
      } else {
        console.log('All slots:', data); // Debug log
        setAllSlots(data.filter(slot => !slot.is_booked));
      }
    } catch (error) {
      console.error('Error fetching all slots:', error);
      setAllSlots([]);
      Alert.alert('Error', 'Failed to fetch teacher slots');
    }
  };

  // Fetch available slots for a specific date
  const fetchAvailableSlots = async (teacherId, date) => {
    try {
      const response = await fetch(
        'https://3caa-110-235-239-151.ngrok-free.app/api/booking/get-teacher-slots/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            date: date.toISOString().split('T')[0],
          }),
        }
      );
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching available slots:', data.error);
        setAvailableSlots([]);
        Alert.alert('Error', data.error);
      } else {
        console.log('Available slots for date:', data); // Debug log
        setAvailableSlots(data.filter(slot => !slot.is_booked));
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
      Alert.alert('Error', 'Failed to fetch available slots');
    }
  };

  const fetchBookedClasses = async () => {
    try {
      const response = await fetch(
        'https://3caa-110-235-239-151.ngrok-free.app/api/booking/get-student-bookings/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ student_id: userData.user_id }),
        }
      );
      const data = await response.json();
      console.log('Fetched booked classes:', data); // Debug log
      setBookedClasses(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch booked classes');
    }
  };

  const handleBookSlot = (slot) => {
    Alert.alert(
      'Confirm Booking',
      `Book slot on ${slot.date} from ${slot.start_time} to ${slot.end_time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (ws) {
              setBookingSlotId(slot.id);
              ws.send(JSON.stringify({
                action: 'book_slot',
                slot_id: slot.id,
                student_id: userData.user_id,
              }));
            }
          },
        },
      ]
    );
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    // Function to check if a day has available slots
    const hasAvailableSlots = (day) => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return allSlots.some(slot => slot.date === dateStr);
    };

    return (
      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            setCurrentDate(newDate);
            // No need to refetch slots since we fetch all future slots
          }}>
            <Text style={styles.calendarNav}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            setCurrentDate(newDate);
            // No need to refetch slots since we fetch all future slots
          }}>
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
              style={[
                styles.calendarDate,
                hasAvailableSlots(day) && styles.availableDate,
              ]}
              onPress={() => {
                const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                setSelectedDate(selected);
                if (selectedTeacher) {
                  fetchAvailableSlots(selectedTeacher.user_id, selected);
                }
              }}
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
        source={require('../assets/images/10.jpg')}
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
              <Text style={styles.title}>Book Classes</Text>
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(200).duration(500)}
            >
              <Text style={styles.sectionTitle}>Select Teacher</Text>
              {teachers.length === 0 ? (
                <Text style={styles.emptyText}>No teachers available.</Text>
              ) : (
                <FlatList
                  data={teachers}
                  horizontal
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.teacherCard, selectedTeacher?.user_id === item.user_id && styles.selectedTeacher]}
                      onPress={() => {
                        setSelectedTeacher(item);
                        // Fetch all future slots when a teacher is selected
                        fetchAllSlots(item.user_id);
                        // If a date is already selected, fetch slots for that date
                        if (selectedDate) {
                          fetchAvailableSlots(item.user_id, selectedDate);
                        }
                      }}
                    >
                      <Text style={styles.teacherName}>{item.name}</Text>
                      <Text style={styles.teacherSubject}>{item.subject}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.user_id}
                />
              )}
            </Animated.View>

            <Animated.View 
              entering={FadeInUp.delay(300).duration(500)}
            >
              {renderCalendar()}
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(400).duration(500)}
            >
              <Text style={styles.sectionTitle}>Available Slots</Text>
              {!selectedTeacher ? (
                <Text style={styles.emptyText}>Please select a teacher to view available slots.</Text>
              ) : !selectedDate ? (
                <Text style={styles.emptyText}>Please select a date to view available slots.</Text>
              ) : availableSlots.length === 0 ? (
                <Text style={styles.emptyText}>No available slots for this date.</Text>
              ) : (
                <FlatList
                  data={availableSlots}
                  renderItem={({ item }) => (
                    <View style={styles.slotCard}>
                      <Text style={styles.slotTime}>{item.date} {item.start_time} - {item.end_time}</Text>
                      <AnimatedTouchableOpacity
                        style={[styles.bookButton, bookingSlotId === item.id && styles.disabledButton]}
                        onPress={() => handleBookSlot(item)}
                        disabled={bookingSlotId === item.id}
                      >
                        <Text style={styles.bookButtonText}>
                          {bookingSlotId === item.id ? 'Booking...' : 'Book Slot'}
                        </Text>
                      </AnimatedTouchableOpacity>
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
              <Text style={styles.sectionTitle}>Booked Classes</Text>
              {bookedClasses.length === 0 ? (
                <Text style={styles.emptyText}>No booked classes.</Text>
              ) : (
                <FlatList
                  data={bookedClasses}
                  renderItem={({ item }) => (
                    <View style={styles.slotCard}>
                      <Text style={styles.slotTime}>Teacher: {item.teacher_name}</Text>
                      <Text style={styles.slotTime}>{item.date} {item.start_time} - {item.end_time}</Text>
                      <Text style={styles.slotStatus}>Status: {item.status}</Text>
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
  teacherCard: { 
    padding: 15, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 12, 
    marginRight: 10, 
    alignItems: 'center',
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedTeacher: { 
    borderColor: '#9333EA', 
    borderWidth: 2,
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
  },
  teacherName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  teacherSubject: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.6)' 
  },
  slotCard: { 
    padding: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 12, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  slotTime: { 
    fontSize: 14, 
    color: '#FFFFFF' 
  },
  slotStatus: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.6)' 
  },
  bookButton: { 
    backgroundColor: 'rgba(147, 51, 234, 0.8)', 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 9999,
  },
  disabledButton: { 
    backgroundColor: 'rgba(165, 180, 252, 0.7)', 
    opacity: 0.7,
  },
  bookButtonText: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: 'bold',
  },
  calendar: { 
    marginBottom: 20,
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
    color: '#FFFFFF'
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
    color: 'rgba(255, 255, 255, 0.8)'
  },
  calendarDate: { 
    width: '14.28%', 
    padding: 10, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.2)' 
  },
  availableDate: { 
    backgroundColor: 'rgba(147, 51, 234, 0.3)' 
  },
  flatListContainer: {
    maxHeight: 250,
  },
});

export default StudentBooking;