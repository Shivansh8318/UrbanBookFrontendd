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
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import ReconnectingWebSocket from 'react-native-reconnecting-websocket';
import { WebView } from 'react-native-webview';

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
  const [showMeeting, setShowMeeting] = useState(false);
  const meetingURL = 'https://shivansh-videoconf-309.app.100ms.live/meeting/uvr-mzvu-vgd';

  useEffect(() => {
    const websocket = new ReconnectingWebSocket(`wss://3cc0-146-196-34-220.ngrok-free.app/ws/booking/${userData.user_id}/`);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      // Fetch slots immediately after connection is established
      fetchSlots();
    };
    
    websocket.onmessage = (e) => {
      try {
        console.log('WebSocket Message Received:', e.data); // Debug log
        const data = JSON.parse(e.data);
        
        if (data.type === 'slot_update') {
          console.log('Slot update received:', data);
          
          // Update UI optimistically based on the update type
          if (data.action === 'added') {
            const newSlot = data.slot;
            setUpcomingSlots(prevSlots => {
              // Check if slot already exists (might have been added optimistically)
              const exists = prevSlots.some(slot => 
                slot.id === newSlot.id || 
                (slot.date === newSlot.date && 
                 slot.start_time === newSlot.start_time && 
                 slot.end_time === newSlot.end_time)
              );
              
              if (exists) return prevSlots;
              
              // Add new slot and sort
              const updatedSlots = [...prevSlots, newSlot].sort((a, b) => {
                const dateComparison = new Date(a.date) - new Date(b.date);
                if (dateComparison !== 0) return dateComparison;
                return a.start_time.localeCompare(b.start_time);
              });
              
              return updatedSlots;
            });
          } else if (data.action === 'deleted') {
            // Remove the deleted slot
            setUpcomingSlots(prevSlots => 
              prevSlots.filter(slot => slot.id !== data.slot_id)
            );
          }
          
          // After handling optimistically, still fetch to ensure consistency
          setTimeout(() => fetchSlots(), 500);
        } else if (data.type === 'booking_update') {
          console.log('Booking update received:', data);
          // Always fetch for booking updates as they affect both lists
          fetchSlots();
        } else if (data.type === 'slots_count') {
          console.log('Slots count from server:', data.count);
          // If the count doesn't match our state, refetch
          if (data.count !== upcomingSlots.length + bookedSlots.length) {
            console.log('Slot count mismatch, refetching...');
            fetchSlots();
          }
        } else if (data.type === 'error') {
          console.log('WebSocket Error:', data.message);
          Alert.alert('Error', data.message);
          // Refetch to ensure we're in sync with server
          fetchSlots();
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        // Refetch on error to maintain consistency
        fetchSlots();
      }
    };
    
    websocket.onerror = (e) => {
      console.error('WebSocket Error:', e);
      Alert.alert('Connection Error', 'Failed to connect to real-time updates. Trying to reconnect...');
      // Retry fetching slots directly on connection error
      fetchSlots();
    };
    
    websocket.onclose = () => {
      console.log('WebSocket Disconnected - will automatically reconnect');
    };

    // Set up a periodic fetch to ensure data consistency even if WebSocket updates fail
    const intervalId = setInterval(() => {
      console.log('Performing periodic slot refresh');
      fetchSlots();
    }, 30000); // Refresh every 30 seconds

    return () => {
      websocket.close();
      clearInterval(intervalId);
    };
  }, [userData.user_id]);

  useEffect(() => {
    fetchSlots();
  }, [userData]);

  const fetchSlots = async () => {
    try {
      console.log('Fetching slots for teacher:', userData.user_id);
      
      // Add a timestamp to prevent cache issues
      const timestamp = new Date().getTime();
      const url = `https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-teacher-slots/?t=${timestamp}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ 
          teacher_id: userData.user_id,
          limit: 100 // Request a higher limit to ensure we get all slots
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching slots:', data.error);
        setUpcomingSlots(prevSlots => prevSlots); // Keep previous state
        setBookedSlots(prevSlots => prevSlots); // Keep previous state
        Alert.alert('Error', data.error);
      } else {
        console.log('Fetched slots total count:', data.length);
        
        // Sort slots by date and time for better display
        const sortedSlots = [...data].sort((a, b) => {
          // First compare by date
          const dateComparison = new Date(a.date) - new Date(b.date);
          if (dateComparison !== 0) return dateComparison;
          
          // If same date, compare by start time
          return a.start_time.localeCompare(b.start_time);
        });
        
        const upcoming = sortedSlots.filter(slot => !slot.is_booked);
        const booked = sortedSlots.filter(slot => slot.is_booked);
        
        console.log('Upcoming slots count:', upcoming.length);
        console.log('Booked slots count:', booked.length);
        
        // Filter out temporary slots when updating
        setUpcomingSlots(prevSlots => {
          // Remove any temporary slots
          const withoutTemp = prevSlots.filter(slot => !String(slot.id).startsWith('temp_'));
          
          // If lengths match and all IDs match, don't update to avoid unnecessary re-renders
          const idsMatch = withoutTemp.length === upcoming.length && 
            withoutTemp.every(slot => upcoming.some(newSlot => newSlot.id === slot.id));
            
          if (idsMatch) {
            console.log('Upcoming slots unchanged, skipping update');
            return prevSlots;
          }
          
          return upcoming;
        });
        
        setBookedSlots(booked);
      }
    } catch (error) {
      console.error('Error fetching slots:', error.message);
      // Don't clear existing slots on error
      Alert.alert('Error', 'Failed to fetch slots: ' + error.message);
      
      // Retry fetch after a delay
      setTimeout(() => {
        console.log('Retrying slot fetch after error...');
        fetchSlots();
      }, 5000);
    }
  };

  const handleAddSlot = () => {
    if (!date || !startTime || !endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Error', 'Time must be in HH:MM format (24-hour)');
      return;
    }
    
    // Ensure end time is after start time
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }
    
    // Create slot data object for both WS message and local update
    const newSlot = {
      teacher_id: userData.user_id,
      date,
      start_time: startTime,
      end_time: endTime,
      is_booked: false,
      // Generate a temporary ID for local use
      id: `temp_${Date.now()}`
    };
    
    Alert.alert(
      'Confirm Slot',
      `Add slot on ${date} from ${startTime} to ${endTime}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            if (ws) {
              try {
                console.log('Sending add_slot message:', newSlot);
                
                // Clear inputs immediately
                setDate('');
                setStartTime('');
                setEndTime('');
                
                // Add the slot to UI immediately (optimistic update)
                setUpcomingSlots(prevSlots => {
                  const updatedSlots = [...prevSlots, newSlot];
                  // Sort the slots as in fetchSlots
                  return updatedSlots.sort((a, b) => {
                    const dateComparison = new Date(a.date) - new Date(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    return a.start_time.localeCompare(b.start_time);
                  });
                });
                
                // Then send the WebSocket message
                ws.send(JSON.stringify({
                  action: 'add_slot',
                  ...newSlot
                }));
                
                // Schedule a delayed refetch to ensure server sync
                setTimeout(() => {
                  fetchSlots();
                }, 1000);
                
                // Show a temporary notification
                Alert.alert('Success', 'Slot added successfully');
              } catch (error) {
                console.error('Error adding slot:', error);
                Alert.alert('Error', 'Failed to add slot. Please try again.');
                // Make sure to fetch again in case of error
                fetchSlots();
              }
            } else {
              Alert.alert('Error', 'WebSocket connection not available. Please try again later.');
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
              <Text style={styles.infoText}>Total: {upcomingSlots.length}</Text>
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
                  style={[styles.flatListContainer, { maxHeight: Math.min(upcomingSlots.length * 70, 250) }]}
                  initialNumToRender={10}
                  maxToRenderPerBatch={20}
                  windowSize={21}
                />
              )}
            </Animated.View>

            <Animated.View 
              style={styles.section}
              entering={FadeInUp.delay(500).duration(500)}
            >
              <Text style={styles.sectionTitle}>Booked Slots</Text>
              <Text style={styles.infoText}>Total: {bookedSlots.length}</Text>
              {bookedSlots.length === 0 ? (
                <Text style={styles.emptyText}>No booked slots.</Text>
              ) : (
                <FlatList
                  data={bookedSlots}
                  renderItem={({ item }) => (
                    <View style={styles.slotCard}>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotText}>{item.date} {item.start_time} - {item.end_time}</Text>
                        {item.status && <Text style={styles.statusText}>Status: {item.status}</Text>}
                        {item.student_name && <Text style={styles.studentText}>Student: {item.student_name}</Text>}
                      </View>
                      <TouchableOpacity
                        style={styles.startClassButton}
                        onPress={() => setShowMeeting(true)}
                      >
                        <Text style={styles.buttonText}>Start Class</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  nestedScrollEnabled={true}
                  style={[styles.flatListContainer, { maxHeight: Math.min(bookedSlots.length * 70, 250) }]}
                  initialNumToRender={10}
                  maxToRenderPerBatch={20}
                  windowSize={21}
                />
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Video Meeting Modal */}
      {showMeeting && (
        <Modal
          visible={showMeeting}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowMeeting(false);
          }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <WebView
              source={{ uri: meetingURL }}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              startInLoadingState
            />
          </SafeAreaView>
        </Modal>
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  slotInfo: {
    flexDirection: 'column',
  },
  studentText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  startClassButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: '#EF4444',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default TeacherBooking;