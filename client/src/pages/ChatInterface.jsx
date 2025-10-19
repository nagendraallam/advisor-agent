import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ChatInterface.css';

function ChatInterface({ user }) {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []);

  // Load messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      loadTasks(activeChat.id);
    } else {
      setMessages([]);
      setTasks([]);
    }
  }, [activeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      setLoadingChats(true);
      const response = await axios.get('/api/chat/list', { withCredentials: true });
      const chatList = response.data.chats || [];
      setChats(chatList);
      
      // Set first chat as active if no active chat
      if (chatList.length > 0 && !activeChat) {
        setActiveChat(chatList[0]);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const response = await axios.get(`/api/chat/${chatId}/messages`, { withCredentials: true });
      const msgs = response.data.messages || [];
      
      // Transform to match expected format
      const formattedMessages = msgs.map(msg => ({
        type: msg.role,
        message: msg.content,
        timestamp: msg.timestamp,
        sources: msg.context?.searchResults || []
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  const loadTasks = async (chatId) => {
    try {
      const response = await axios.get(`/api/chat/${chatId}/tasks`, { withCredentials: true });
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await axios.post('/api/chat/create', 
        { name: 'New Chat' }, 
        { withCredentials: true }
      );
      
      const newChat = response.data.chat;
      setChats(prev => [newChat, ...prev]);
      setActiveChat(newChat);
    } catch (error) {
      console.error('Failed to create chat:', error);
      alert('Failed to create new chat');
    }
  };

  const deleteChat = async (chatId) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await axios.delete(`/api/chat/${chatId}`, { withCredentials: true });
      setChats(prev => prev.filter(c => c.id !== chatId));
      
      if (activeChat?.id === chatId) {
        setActiveChat(chats.length > 1 ? chats[0] : null);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Failed to delete chat');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    // If no active chat, create one
    if (!activeChat) {
      await createNewChat();
      // Wait for activeChat to be set
      return;
    }

    const userMessage = {
      type: 'user',
      message: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`/api/chat/${activeChat.id}/message`, 
        { message: input },
        { withCredentials: true }
      );

      const assistantMessage = {
        type: 'assistant',
        message: response.data.message,
        timestamp: response.data.timestamp,
        sources: response.data.sources || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Reload chats to update names and activity
      loadChats();
      
      // Reload tasks in case new ones were created
      loadTasks(activeChat.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMsg = error.response?.data?.message || 'Sorry, I encountered an error. Please try again.';
      const errorMessage = {
        type: 'assistant',
        message: errorMsg,
        timestamp: new Date().toISOString(),
        sources: []
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/sync/all', {}, { withCredentials: true });
      await axios.post('/api/embeddings/generate', {}, { withCredentials: true });
      alert('Data synced successfully!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const cancelTask = async (taskId) => {
    try {
      await axios.post(`/api/chat/tasks/${taskId}/cancel`, {}, { withCredentials: true });
      loadTasks(activeChat.id);
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const activeTasks = tasks.filter(t => t.status === 'waiting');

  return (
    <div className="chat-interface">
      <nav className="chat-nav">
        <div className="nav-content">
          <div className="logo">
            <button onClick={() => setShowSidebar(!showSidebar)} className="btn-icon">
              ☰
            </button>
            <h2>🤖 Advisor AI</h2>
          </div>
          <div className="nav-actions">
            <button onClick={handleSync} className="btn-outline" disabled={syncing}>
              {syncing ? '⏳ Syncing...' : '🔄 Sync Data'}
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn-outline">
              Dashboard
            </button>
            <div className="user-info">
              {user.avatar && <img src={user.avatar} alt={user.name} className="user-avatar" />}
              <span className="user-name">{user.name}</span>
            </div>
            <button onClick={handleLogout} className="btn-outline">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="chat-layout">
        {/* Chat Sidebar */}
        {showSidebar && (
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <h3>Chats</h3>
              <button onClick={createNewChat} className="btn-new-chat" title="New Chat">
                ➕
              </button>
            </div>
            
            {loadingChats ? (
              <div className="loading-chats">Loading chats...</div>
            ) : chats.length === 0 ? (
              <div className="no-chats">
                <p>No chats yet</p>
                <button onClick={createNewChat} className="btn-primary">
                  Start New Chat
                </button>
              </div>
            ) : (
              <div className="chats-list">
                {chats.map(chat => (
                  <div 
                    key={chat.id}
                    className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => setActiveChat(chat)}
                  >
                    <div className="chat-item-content">
                      <div className="chat-name">
                        {chat.name}
                        {chat.activeTasks > 0 && (
                          <span className="task-badge" title="Active tasks">
                            {chat.activeTasks}
                          </span>
                        )}
                      </div>
                      <div className="chat-time">
                        {new Date(chat.lastActivity).toLocaleDateString()}
                      </div>
                    </div>
                    <button 
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Chat Area */}
        <div className="chat-main">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <h2>{activeChat.name}</h2>
                {activeTasks.length > 0 && (
                  <div className="active-tasks-badge">
                    ⏳ {activeTasks.length} ongoing task{activeTasks.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Ongoing Tasks Panel */}
              {activeTasks.length > 0 && (
                <div className="tasks-panel">
                  <div className="tasks-header">🎯 Ongoing Tasks</div>
                  <div className="tasks-list">
                    {activeTasks.map(task => (
                      <div key={task.id} className="task-item">
                        <div className="task-content">
                          <div className="task-description">{task.description}</div>
                          <div className="task-meta">
                            Waiting for: <strong>{task.expectedSenderName || task.expectedSender}</strong>
                          </div>
                        </div>
                        <button 
                          onClick={() => cancelTask(task.id)}
                          className="btn-cancel-task"
                          title="Cancel task"
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Container */}
              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="welcome-message">
                    <h3>👋 Welcome to {activeChat.name}!</h3>
                    <p>Start a conversation by asking me anything.</p>
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div key={index} className={`message ${msg.type}`}>
                    <div className="message-avatar">
                      {msg.type === 'user' ? (
                        user.avatar ? (
                          <img src={user.avatar} alt="You" />
                        ) : (
                          <div className="avatar-placeholder">👤</div>
                        )
                      ) : (
                        <div className="avatar-placeholder">🤖</div>
                      )}
                    </div>
                    <div className="message-content">
                      <div className="message-text">{msg.message}</div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="message-sources">
                          <div className="sources-label">📚 Sources:</div>
                          {msg.sources.map((source, idx) => (
                            <div key={idx} className="source-item">
                              <span className="source-type">{source.type}</span>
                              <span className="source-snippet">{source.snippet}</span>
                              {source.similarity && (
                                <span className="source-similarity">
                                  {(source.similarity * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="message-timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message assistant">
                    <div className="message-avatar">
                      <div className="avatar-placeholder">🤖</div>
                    </div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Container */}
              <div className="input-container">
                <form onSubmit={handleSubmit} className="chat-form">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything about your business..."
                    className="chat-input"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    className="send-button"
                    disabled={!input.trim() || loading}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path 
                        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
                <div className="input-hint">
                  💡 Try: "Send an email to john@example.com and notify me when he responds"
                </div>
              </div>
            </>
          ) : (
            <div className="no-active-chat">
              <h2>No Chat Selected</h2>
              <p>Select a chat from the sidebar or create a new one</p>
              <button onClick={createNewChat} className="btn-primary">
                ➕ Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
