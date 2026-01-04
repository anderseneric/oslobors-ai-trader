import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, Bot, User } from 'lucide-react'
import { chatAPI } from '../services/api'
import type { ChatMessage } from '../types'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Show welcome message
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hei! I'm your AI trading advisor.

Ask me about your portfolio, trades, or market news.`,
        timestamp: new Date().toISOString()
      }])
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
        messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0) // Exclude welcome message
      )

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp
      }

      setMessages(prev => [...prev, assistantMessage])
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
      inputRef.current?.focus()
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <MessageCircle className="w-8 h-8 text-blue-500" />
        <div>
          <h2 className="text-2xl font-bold">AI Trading Assistant</h2>
          <p className="text-sm text-gray-400">Ask me anything about your portfolio and trading strategies</p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-3 max-w-3xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-blue-600'
                  : 'bg-gradient-to-br from-purple-600 to-blue-600'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-6 h-6 text-white" />
                ) : (
                  <Bot className="w-6 h-6 text-white" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-2xl px-5 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-100'
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
            <div className="flex items-start space-x-3 max-w-3xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="bg-slate-700 rounded-2xl px-5 py-3">
                <div className="flex space-x-2">
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
      <div className="card p-4 bg-slate-800 border-slate-700">
        <div className="flex space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your trades... (Norwegian or English)"
            className="flex-1 input"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`btn-primary flex items-center space-x-2 ${
              !input.trim() || loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Send className="w-5 h-5" />
            <span>Send</span>
          </button>
        </div>

        {/* Quick Examples */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">Quick questions:</span>
          {[
            'Portfolio risk?',
            'Sell MOWI now?',
            'Trade plan for DNB',
            'Best entry for Equinor?'
          ].map((example, i) => (
            <button
              key={i}
              onClick={() => setInput(example)}
              className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-gray-300 transition-colors"
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
