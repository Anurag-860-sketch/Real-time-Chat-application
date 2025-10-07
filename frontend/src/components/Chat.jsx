import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import ChatList from './ChatList';
import MessageInput from './MessageInput';

const SOCKET_URL = 'http://localhost:5000';

const Chat = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Connect to socket
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false
    });

    // Emit user connected
    socketRef.current.emit('user_connected', user._id);

    // Listen for user status changes
    socketRef.current.on('user_status_changed', ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        if (isOnline) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    });

    // Listen for incoming messages
    socketRef.current.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    // Listen for message sent confirmation
    socketRef.current.on('message_sent', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    // Listen for typing indicator
    socketRef.current.on('user_typing', ({ userId }) => {
      setTypingUsers((prev) => new Set(prev).add(userId));
    });

    // Listen for stop typing
    socketRef.current.on('user_stopped_typing', ({ userId }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, navigate]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('/api/auth/users');
        setUsers(response.data);
        
        // Set initial online users
        const online = new Set(
          response.data.filter(u => u.isOnline).map(u => u._id)
        );
        setOnlineUsers(online);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Fetch messages when user is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (selectedUser) {
        try {
          const response = await axios.get(`/api/messages/${selectedUser._id}`);
          setMessages(response.data);
          scrollToBottom();
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };

    fetchMessages();
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
  };

  const handleSendMessage = (content) => {
    if (selectedUser && socketRef.current) {
      socketRef.current.emit('send_message', {
        sender: user._id,
        receiver: selectedUser._id,
        content
      });
    }
  };

  const handleTyping = () => {
    if (selectedUser && socketRef.current) {
      socketRef.current.emit('typing', {
        senderId: user._id,
        receiverId: selectedUser._id
      });
    }
  };

  const handleStopTyping = () => {
    if (selectedUser && socketRef.current) {
      socketRef.current.emit('stop_typing', {
        senderId: user._id,
        receiverId: selectedUser._id
      });
    }
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    logout();
    navigate('/login');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="current-user">
            <img src={user?.avatar} alt={user?.username} className="user-avatar" />
            <span>{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
        
        <ChatList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-user-info">
                <img src={selectedUser.avatar} alt={selectedUser.username} className="user-avatar" />
                <div>
                  <h3>{selectedUser.username}</h3>
                  <span className="user-status-text">
                    {onlineUsers.has(selectedUser._id) ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`message ${message.sender._id === user._id ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      <p>{message.content}</p>
                      <span className="message-time">{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
              
              {/* Typing Indicator */}
              {typingUsers.has(selectedUser._id) && (
                <div className="typing-indicator">
                  <span>{selectedUser.username} is typing...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
            />
          </>
        ) : (
          <div className="no-chat-selected">
            <h2>Welcome to Chat App</h2>
            <p>Select a user from the list to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;