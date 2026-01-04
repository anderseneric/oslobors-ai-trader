import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, Bot, User, X, Minus } from 'lucide-react'
import { chatAPI } from '../services/api'
import type { ChatMessage } from '../types'

const STORAGE_KEY = 'trading-chat-history'
const MAX_MESSAGES = 50

export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isOpenRef = useRef(isOpen)
  const isMinimizedRef = useRef(isMinimized)

  // Keep refs in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen
    isMinimizedRef.current = isMinimized
  }, [isOpen, isMinimized])

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMessages(parsed)
      } catch (error) {
        console.error('Error loading chat history:', error)
        initializeWelcomeMessage()
      }
    } else {
      initializeWelcomeMessage()
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Keep only last 50 messages
      const messagesToSave = messages.slice(-MAX_MESSAGES)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave))
    }
  }, [messages])

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
    }
  }, [messages, isOpen, isMinimized])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])

  const initializeWelcomeMessage = () => {
    setMessages([{
      role: 'assistant',
      content: `Hei! I'm your AI trading advisor.

Ask me about your portfolio, trades, or market news.`,
      timestamp: new Date().toISOString()
    }])
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleOpen = () => {
    setIsOpen(true)
    setIsMinimized(false)
    setHasNewMessage(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMinimized(false)
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await chatAPI.sendMessage(
        userMessage.content,
        messages.filter((m, idx) => idx > 0 || m.role === 'user') // Exclude initial welcome message
      )

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp
      }

      setMessages(prev => [...prev, assistantMessage])

      // Show notification badge if chat is closed or minimized (use ref to get current value)
      if (!isOpenRef.current || isMinimizedRef.current) {
        setHasNewMessage(true)
      }
    } catch (error) {
      console.error('Error sending message:', error)

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }

  const clearHistory = () => {
    if (confirm('Clear all chat history?')) {
      localStorage.removeItem(STORAGE_KEY)
      initializeWelcomeMessage()
    }
  }

  return (
    <>
      {/* Floating Button */}
      {(!isOpen || isMinimized) && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3">
          {/* Tooltip Bubble */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-2xl shadow-lg text-sm font-medium whitespace-nowrap animate-bounce-subtle">
            Need trading insights?
            <div className="absolute -bottom-1 right-6 w-3 h-3 bg-purple-600 transform rotate-45"></div>
          </div>

          {/* Chat Button */}
          <button
            onClick={handleOpen}
            className="relative w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 flex items-center justify-center group hover:scale-110"
          >
            <MessageCircle className="w-8 h-8 text-white" />
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white z-10">
                !
              </span>
            )}
          </button>
        </div>
      )}

      {/* Chat Modal */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-500/20 flex flex-col z-50 animate-slideUp">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-blue-500/20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">AI Trading Assistant</h3>
                <p className="text-xs text-blue-100">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMinimize}
                className="w-8 h-8 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center"
              >
                <Minus className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-black">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-br from-purple-600 to-blue-600'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block rounded-2xl px-4 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900/80 backdrop-blur-md border border-blue-500/10 text-gray-100'
                    }`}>
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-2">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-900/80 backdrop-blur-md border border-blue-500/10 rounded-2xl px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-blue-500/20 bg-black/40 backdrop-blur-md">
            <div className="flex space-x-2 mb-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 bg-black/60 border border-blue-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className={`bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors flex items-center ${
                  !input.trim() || loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={clearHistory}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Clear history
              </button>
              <span className="text-gray-500">{messages.length} messages</span>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
