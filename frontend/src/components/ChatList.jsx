import React from 'react';

const ChatList = ({ users, selectedUser, onSelectUser, onlineUsers }) => {
  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h3>Contacts</h3>
      </div>
      
      <div className="users-list">
        {users.length === 0 ? (
          <div className="no-users">No users available</div>
        ) : (
          users.map((user) => (
            <div
              key={user._id}
              className={`user-item ${selectedUser?._id === user._id ? 'active' : ''}`}
              onClick={() => onSelectUser(user)}
            >
              <div className="user-avatar-container">
                <img src={user.avatar} alt={user.username} className="user-avatar" />
                <span className={`status-indicator ${onlineUsers.has(user._id) ? 'online' : 'offline'}`}></span>
              </div>
              
              <div className="user-info">
                <h4>{user.username}</h4>
                <p className="user-status">
                  {onlineUsers.has(user._id) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;