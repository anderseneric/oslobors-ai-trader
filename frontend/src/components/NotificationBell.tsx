import { useState, useEffect } from 'react'
import { Bell, X, Check, CheckCheck, AlertCircle, TrendingUp, Newspaper } from 'lucide-react'
import { notificationsAPI } from '../services/api'
import type { Notification } from '../types'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  useEffect(() => {
    loadNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      const [unreadRes, allRes] = await Promise.all([
        notificationsAPI.getUnread(),
        notificationsAPI.getAll(20)
      ])

      if (unreadRes.success) {
        setUnreadCount(unreadRes.count)
      }

      if (allRes.success) {
        setNotifications(allRes.data)
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    }
  }

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id)
      await loadNotifications()
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead()
      await loadNotifications()
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'price_alert':
        return <TrendingUp className="w-5 h-5 text-blue-400" />
      case 'technical_breakout':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'news_alert':
        return <Newspaper className="w-5 h-5 text-purple-400" />
      case 'daily_summary':
        return <Check className="w-5 h-5 text-green-400" />
      default:
        return <Bell className="w-5 h-5 text-white/60" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 border-red-500/30'
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30'
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30'
      default:
        return 'bg-white/5 border-white/10'
    }
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read_status)
    : notifications

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('no-NO', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-white/80" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0e27] border-l border-white/10 z-50 shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Bell className="w-6 h-6 mr-2" />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 bg-red-500/20 text-red-300 text-sm px-2 py-1 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filter === 'unread'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center space-x-1 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 p-8">
                  <Bell className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg mb-2">No notifications</p>
                  <p className="text-sm text-center">
                    You're all caught up! Notifications will appear here when they arrive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        notification.read_status
                          ? 'bg-white/5 border-white/10 opacity-60'
                          : `${getSeverityColor(notification.severity)} hover:shadow-lg`
                      }`}
                      onClick={() => !notification.read_status && handleMarkRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(notification.notification_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="text-sm font-semibold text-white">
                              {notification.title}
                            </h3>
                            {!notification.read_status && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-white/70 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40">
                              {formatTime(notification.created_at)}
                            </span>
                            {notification.ticker && (
                              <span className="bg-white/10 text-white/80 px-2 py-1 rounded">
                                {notification.ticker}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
              <p className="text-xs text-white/40 text-center">
                Notifications are in-app only and update every 30 seconds
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
