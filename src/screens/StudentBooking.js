import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import ReconnectingWebSocket from 'react-native-reconnecting-websocket';
import { WebView } from 'react-native-webview';

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
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOptions, setRazorpayOptions] = useState(null);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const webViewRef = useRef(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState(null);
  const [showMeeting, setShowMeeting] = useState(false);
  const meetingURL = 'https://shivansh-videoconf-309.app.100ms.live/meeting/uvr-mzvu-vgd';

  useEffect(() => {
    const setupWebSocket = () => {
      const websocket = new ReconnectingWebSocket(
        `wss://3cc0-146-196-34-220.ngrok-free.app/ws/booking/${userData.user_id}/`
      );
      setWs(websocket);

      websocket.onopen = () => {
        console.log('WebSocket Connected');
        // Refresh booked classes on connect
        fetchBookedClasses();
      };
      
      websocket.onmessage = (e) => {
        try {
          console.log('WebSocket Message Received:', e.data);
          const data = JSON.parse(e.data);
          
          if (data.type === 'booking_update') {
            const bookedSlotId = data.booking.slot_id;
            console.log('Booking update for slot:', bookedSlotId);
            
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
            // Handle new slot or deleted slot
            console.log('Slot update received:', data);
            
            if (data.action === 'added') {
              // Handle new slot addition
              const newSlot = data.slot;
              if (selectedTeacher && newSlot.teacher_id === selectedTeacher.user_id && !newSlot.is_booked) {
                // Update allSlots for calendar highlights
                setAllSlots((prevSlots) => {
                  if (prevSlots.some((slot) => slot.id === newSlot.id)) {
                    return prevSlots;
                  }
                  const updatedSlots = [...prevSlots, newSlot];
                  return updatedSlots.sort((a, b) => {
                    const dateComparison = new Date(a.date) - new Date(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    return a.start_time.localeCompare(b.start_time);
                  });
                });
                
                // Update availableSlots only if the slot matches the selected date
                if (selectedDate && newSlot.date === selectedDate.toISOString().split('T')[0]) {
                  setAvailableSlots((prevSlots) => {
                    if (prevSlots.some((slot) => slot.id === newSlot.id)) {
                      return prevSlots;
                    }
                    const updatedSlots = [...prevSlots, newSlot];
                    return updatedSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
                  });
                }
              }
            } else if (data.action === 'deleted' && data.slot_id) {
              // Remove the deleted slot
              setAllSlots(prevSlots => prevSlots.filter(slot => slot.id !== data.slot_id));
              setAvailableSlots(prevSlots => prevSlots.filter(slot => slot.id !== data.slot_id));
            }
          } else if (data.type === 'slots_count') {
            console.log('Slots count from server:', data.count);
            
            // If we have a teacher selected, check if our count matches
            if (selectedTeacher && 
                data.teacher_id === selectedTeacher.user_id && 
                data.count !== allSlots.length) {
              console.log('Slot count mismatch, refetching...');
              fetchAllSlots(selectedTeacher.user_id);
              if (selectedDate) {
                fetchAvailableSlots(selectedTeacher.user_id, selectedDate);
              }
            }
          } else if (data.type === 'error') {
            setBookingSlotId(null);
            Alert.alert('Booking Error', data.message);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error.message);
        }
      };
      
      websocket.onerror = (e) => {
        console.error('WebSocket Error:', e);
        Alert.alert('Connection Error', 'Failed to connect to real-time updates. Some features may not work.');
      };
      
      websocket.onclose = () => console.log('WebSocket Disconnected');

      return websocket;
    };
    
    // Initialize WebSocket connection
    const websocket = setupWebSocket();
    
    // Set up a periodic fetch to ensure data consistency even if WebSocket updates fail
    const intervalId = setInterval(() => {
      if (selectedTeacher) {
        console.log('Performing periodic refresh');
        fetchAllSlots(selectedTeacher.user_id);
        if (selectedDate) {
          fetchAvailableSlots(selectedTeacher.user_id, selectedDate);
        }
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      // Properly close WebSocket connection
      if (websocket) {
        websocket.close();
      }
      clearInterval(intervalId);
    };
  }, [userData.user_id]);

  useEffect(() => {
    fetchTeachers();
    fetchBookedClasses();
  }, [userData]);

  // Add a new effect to fetch slots for all teachers when component loads
  useEffect(() => {
    const fetchAllTeacherSlots = async () => {
      try {
        console.log('Fetching all teachers slots for initial load');
        const timestamp = new Date().getTime();
        const response = await fetch(
          `https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-all-teacher-slots/?t=${timestamp}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched all teachers slots successfully. Count:', data.length);
      } catch (error) {
        console.error('Failed to fetch all teachers slots:', error.message);
      }
    };
    
    // Call the function to fetch all slots
    fetchAllTeacherSlots();
  }, []);

  // Fetch all teachers
  const fetchTeachers = async () => {
    try {
      const response = await fetch(
        'https://3cc0-146-196-34-220.ngrok-free.app/api/teacher/list-teachers/',
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
      console.log('Fetching all slots for teacher:', teacherId);
      
      // First, try with a direct API call - helpful for debugging
      const directApiCall = async () => {
        try {
          console.log('Making direct API call to fetch all slots');
          const response = await fetch(
            `https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-all-slots-for-teacher/${teacherId}/`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            console.log('Direct API call result - slots count:', data.length);
          }
        } catch (err) {
          console.log('Direct API call failed, continuing with regular flow:', err.message);
        }
      };
      
      // Make the direct call first, but don't wait for it - just for debugging
      directApiCall();
      
      // Add timestamp and random number to prevent caching
      const timestamp = new Date().getTime();
      const randomParam = Math.floor(Math.random() * 100000);
      const response = await fetch(
        `https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-teacher-slots/?t=${timestamp}&r=${randomParam}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            limit: 500, // Increased limit to ensure ALL slots are fetched
            include_all: true // Ask server to include ALL slots
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching all slots:', data.error);
        setAllSlots([]);
        Alert.alert('Error', data.error);
      } else {
        console.log('All slots count from API:', data.length);
        
        // Log first few slots for debugging
        if (data.length > 0) {
          console.log('First 3 slots sample:', data.slice(0, 3));
        }
        
        // Only keep future slots
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Sort slots for better display
        const sortedSlots = [...data]
          .filter(slot => {
            // Keep only non-booked slots in the future
            const slotDate = new Date(slot.date);
            return !slot.is_booked && slotDate >= now;
          })
          .sort((a, b) => {
            // First compare by date
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison !== 0) return dateComparison;
            
            // If same date, compare by start time
            return a.start_time.localeCompare(b.start_time);
          });
        
        console.log('Available slots total after filtering:', sortedSlots.length);
        
        // Log the dates of all available slots for debugging
        const availableDates = [...new Set(sortedSlots.map(slot => slot.date))];
        console.log('Available dates:', availableDates);
        
        setAllSlots(sortedSlots);
      }
    } catch (error) {
      console.error('Error fetching all slots:', error.message);
      setAllSlots([]);
      Alert.alert('Error', 'Failed to fetch teacher slots: ' + error.message);
    }
  };

  // Fetch available slots for a specific date
  const fetchAvailableSlots = async (teacherId, date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      console.log('Fetching available slots for date:', dateStr);
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(
        `https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-teacher-slots/?t=${timestamp}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            date: dateStr,
            limit: 500 // Increased limit to ensure ALL slots are fetched
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching available slots:', data.error);
        setAvailableSlots([]);
        Alert.alert('Error', data.error);
      } else {
        console.log('Slots received for date:', dateStr, data.length);
        
        // Log all slots for debugging
        if (data.length > 0) {
          console.log('All slots for this date:', data);
        }
        
        // Filter for available slots and sort
        const availableSlots = data
          .filter(slot => !slot.is_booked)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        console.log('Filtered available slots for date:', availableSlots.length);
        
        if (availableSlots.length === 0 && data.length > 0) {
          console.log('Warning: All slots for this date are booked');
        }
        
        setAvailableSlots(availableSlots);
        
        // As a fallback, also check allSlots for the selected date
        if (availableSlots.length === 0) {
          console.log('Checking allSlots as fallback...');
          const fallbackSlots = allSlots.filter(slot => 
            slot.date === dateStr && !slot.is_booked
          );
          
          if (fallbackSlots.length > 0) {
            console.log('Found', fallbackSlots.length, 'slots in allSlots, using those');
            setAvailableSlots(fallbackSlots);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching available slots:', error.message);
      setAvailableSlots([]);
      Alert.alert('Error', 'Failed to fetch available slots: ' + error.message);
    }
  };

  const fetchBookedClasses = async () => {
    try {
      const response = await fetch(
        'https://3cc0-146-196-34-220.ngrok-free.app/api/booking/get-student-bookings/',
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
    // Prevent multiple bookings simultaneously
    if (bookingSlotId) {
      Alert.alert('Please wait', 'A booking is already in progress.');
      return;
    }
    
    Alert.alert(
      'Confirm Booking',
      `Book slot on ${slot.date} from ${slot.start_time} to ${slot.end_time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (ws) {
              try {
                console.log('Booking slot:', slot.id);
                
                // Set booking status and optimistically update UI
                setBookingSlotId(slot.id);
                
                // Optimistically remove the slot from available slots
                setAvailableSlots(prevSlots => prevSlots.filter(s => s.id !== slot.id));
                setAllSlots(prevSlots => prevSlots.filter(s => s.id !== slot.id));
                
                // Send the booking request
                ws.send(JSON.stringify({
                  action: 'book_slot',
                  slot_id: slot.id,
                  student_id: userData.user_id,
                }));
                
                // Set a timeout to clear booking state if no response
                setTimeout(() => {
                  if (bookingSlotId === slot.id) {
                    console.log('Booking timeout, resetting state');
                    setBookingSlotId(null);
                    
                    // Refetch to ensure UI is in sync with server
                    fetchBookedClasses();
                    if (selectedTeacher) {
                      fetchAllSlots(selectedTeacher.user_id);
                      if (selectedDate) {
                        fetchAvailableSlots(selectedTeacher.user_id, selectedDate);
                      }
                    }
                  }
                }, 10000); // 10 second timeout
              } catch (error) {
                console.error('Error sending booking request:', error);
                setBookingSlotId(null);
                Alert.alert('Error', 'Failed to send booking request. Please try again.');
              }
            } else {
              Alert.alert('Error', 'Connection not available. Please try again later.');
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
    
    // Function to count available slots for a day
    const countAvailableSlots = (day) => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return allSlots.filter(slot => slot.date === dateStr).length;
    };
    
    // Check if a date is in the past
    const isPastDate = (day) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date < today;
    };
    
    // Check if a date is selected
    const isSelectedDate = (day) => {
      if (!selectedDate) return false;
      return (
        selectedDate.getFullYear() === currentDate.getFullYear() &&
        selectedDate.getMonth() === currentDate.getMonth() &&
        selectedDate.getDate() === day
      );
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
          {days.map((day) => {
            const hasSlots = hasAvailableSlots(day);
            const isSelected = isSelectedDate(day);
            const isPast = isPastDate(day);
            const slotCount = hasSlots ? countAvailableSlots(day) : 0;
            
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.calendarDate,
                  hasSlots && styles.availableDate,
                  isSelected && styles.selectedDate,
                  isPast && styles.pastDate,
                ]}
                onPress={() => {
                  if (isPast) {
                    Alert.alert('Notice', 'Cannot select dates in the past');
                    return;
                  }
                  
                  const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  setSelectedDate(selected);
                  if (selectedTeacher) {
                    fetchAvailableSlots(selectedTeacher.user_id, selected);
                  }
                }}
                disabled={isPast}
              >
                <Text style={[
                  { textAlign: 'center' },
                  isPast && styles.pastDateText,
                  isSelected && styles.selectedDateText
                ]}>
                  {day}
                </Text>
                {hasSlots && (
                  <View style={styles.slotCountBadge}>
                    <Text style={styles.slotCountText}>{slotCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Update handlePayment function to use correct URL
  const handlePayment = async (booking) => {
    try {
      setProcessingPayment(true);
      setProcessingPaymentId(booking.id);
      setSelectedBookingForPayment(booking);
      
      // Create order on backend
      const response = await fetch(
        'https://3cc0-146-196-34-220.ngrok-free.app/api/payment/create-order/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: booking.id,
            amount: 500, // Fixed amount for now
            currency: 'INR',
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }
      
      const orderData = await response.json();
      console.log('Payment order created:', orderData);
      
      // Configure Razorpay options
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Urban Book',
        description: 'Payment for class booking',
        order_id: orderData.order_id,
        prefill: {
          email: userData.identity_value,
          name: userData.name || 'Student',
        },
        theme: { color: '#9333EA' }
      };
      
      setRazorpayOptions(options);
      setShowRazorpay(true);
    } catch (error) {
      console.error('Error initiating payment:', error);
      Alert.alert('Error', error.message || 'Failed to initiate payment');
    } finally {
      setProcessingPayment(false);
      setProcessingPaymentId(null);
    }
  };
  
  // Update handleRazorpayResponse function to use correct URL
  const handleRazorpayResponse = async (data) => {
    setShowRazorpay(false);
    setProcessingPayment(true);
    
    try {
      if (data.razorpay_payment_id) {
        // Payment successful, verify with backend
        const response = await fetch(
          'https://3cc0-146-196-34-220.ngrok-free.app/api/payment/verify-payment/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_id: data.razorpay_order_id,
              payment_id: data.razorpay_payment_id,
              signature: data.razorpay_signature,
            }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Payment verification failed');
        }
        
        // Refresh bookings list
        fetchBookedClasses();
        Alert.alert('Success', 'Payment completed successfully!');
      } else if (data.error) {
        // Payment failed
        Alert.alert('Payment Failed', data.error.description || 'Payment was unsuccessful');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', error.message || 'Failed to verify payment');
    } finally {
      setProcessingPayment(false);
      setProcessingPaymentId(null);
    }
  };
  
  // Generate HTML for Razorpay WebView
  const generateRazorpayHTML = () => {
    if (!razorpayOptions) return '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Razorpay Payment</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #111827; }
          #payment-button { background-color: #9333EA; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; }
        </style>
      </head>
      <body>
        <button id="payment-button">Pay ₹${parseFloat(razorpayOptions.amount) / 100}</button>

        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          const options = ${JSON.stringify(razorpayOptions)};
          
          const paymentButton = document.getElementById('payment-button');
          paymentButton.addEventListener('click', function() {
            const rzp = new Razorpay(options);
            
            rzp.on('payment.success', function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_success',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }));
            });
            
            rzp.on('payment.error', function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_error',
                error: response.error
              }));
            });
            
            rzp.open();
          });
          
          // Auto-click the button after load
          setTimeout(() => {
            paymentButton.click();
          }, 1000);
        </script>
      </body>
      </html>
    `;
  };
  
  // Handle WebView messages
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        handleRazorpayResponse({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature
        });
      } else if (data.type === 'payment_error') {
        handleRazorpayResponse({ error: data.error });
      }
    } catch (error) {
      console.error('Error processing WebView message:', error);
    }
  };

  // Update renderBookingCard to show Pay Now button regardless of booking status
  const renderBookingCard = (booking) => (
    <View style={styles.slotCard}>
      <View style={styles.bookingInfo}>
        <Text style={styles.slotTime}>Teacher: {booking.teacher_name}</Text>
        <Text style={styles.slotTime}>{booking.date} {booking.start_time} - {booking.end_time}</Text>
        <Text style={[styles.slotStatus, 
          booking.status === 'confirmed' ? styles.statusConfirmed : 
          booking.status === 'canceled' ? styles.statusCanceled : styles.statusPending
        ]}>
          Status: {booking.status}
        </Text>
        {booking.payment_status && (
          <Text style={styles.paidStatus}>Payment: Completed</Text>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {!booking.payment_status && (
          <TouchableOpacity 
            style={[styles.payButton, processingPaymentId === booking.id && styles.disabledButton]}
            onPress={() => handlePayment(booking)}
            disabled={processingPayment}
          >
            <Text style={styles.buttonText}>
              {processingPaymentId === booking.id ? 'Processing...' : 'Pay Now'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.startClassButton}
          onPress={() => setShowMeeting(true)}
        >
          <Text style={styles.buttonText}>Start Class</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
              <Text style={styles.sectionTitle}>
                Available Slots
                {selectedTeacher && <Text style={styles.infoText}> ({availableSlots.length})</Text>}
              </Text>
              {!selectedTeacher ? (
                <Text style={styles.emptyText}>Please select a teacher to view available slots.</Text>
              ) : !selectedDate ? (
                <Text style={styles.emptyText}>Please select a date to view available slots.</Text>
              ) : availableSlots.length === 0 ? (
                <View>
                  <Text style={styles.emptyText}>No available slots for this date.</Text>
                  <Text style={styles.hintText}>Try selecting another date highlighted on the calendar.</Text>
                </View>
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
                  style={[
                    styles.flatListContainer, 
                    { maxHeight: Math.min(availableSlots.length * 80 + 20, 250) }
                  ]}
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
                  renderItem={({ item }) => renderBookingCard(item)}
                  keyExtractor={(item) => item.id.toString()}
                  nestedScrollEnabled={true}
                  style={styles.flatListContainer}
                />
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Razorpay Payment Modal */}
      {showRazorpay && (
        <Modal
          visible={showRazorpay}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowRazorpay(false);
          }}
        >
          <View style={{ flex: 1 }}>
            <WebView
              ref={webViewRef}
              source={{ html: generateRazorpayHTML() }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowRazorpay(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

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
    padding: 15, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 12, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bookingInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  slotTime: { 
    fontSize: 14, 
    color: '#FFFFFF' 
  },
  slotStatus: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.6)' 
  },
  paidStatus: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: 'bold',
    marginTop: 4,
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
  selectedDate: {
    backgroundColor: 'rgba(147, 51, 234, 0.5)',
  },
  pastDate: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pastDateText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  selectedDateText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  slotCountBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute',
    top: 4,
    right: 4,
  },
  slotCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  flatListContainer: {
    maxHeight: 250,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  payButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  statusConfirmed: {
    color: '#34C759',
  },
  statusCanceled: {
    color: '#FF3B30',
  },
  statusPending: {
    color: '#FFCC00',
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
});

export default StudentBooking;