package expo.modules.notificationstimer

import java.net.URL
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

class NotificationsTimerModule : Module() {
  private val TIMER_CHANNEL_ID = "timer_channel"
  private val NOTIFICATION_ID = 1
  private val ACTION_PAUSE = "expo.modules.notificationstimer.PAUSE"
  private val ACTION_RESUME = "expo.modules.notificationstimer.RESUME"
  private val ACTION_STOP = "expo.modules.notificationstimer.STOP"

  private val handler = Handler(Looper.getMainLooper())
  private var runnable: Runnable? = null

  // 1. The Receiver: Listens for button clicks from the Notification
  private val actionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val action = intent.action
      // Emit event to React Native so the App can update its state
      if (action == ACTION_PAUSE) {
        sendEvent("onPauseAction")
      } else if (action == ACTION_RESUME) {
        sendEvent("onResumeAction")
      } else if(action == ACTION_STOP) {
        sendEvent("onStopAction")
      }
    }
  }
  // Helper to format seconds into HH:MM:SS
  private fun formatTime(millis: Long): String {
    val seconds = millis / 1000
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return String.format(Locale.US, "%02d:%02d:%02d", h, m, s)
  }
  override fun definition() = ModuleDefinition {
    Name("NotificationsTimer")
    // Define events we will send to JS
    Events("onPauseAction", "onResumeAction", "onStopAction")

    // Register the receiver when the module loads
    OnCreate {
      val context = appContext.reactContext
      if (context != null) {
        val filter = IntentFilter().apply {
          addAction(ACTION_PAUSE)
          addAction(ACTION_RESUME)
          addAction(ACTION_STOP)
        }
        ContextCompat.registerReceiver(context, actionReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
      }
    }

    // Cleanup when module is destroyed
    OnDestroy {
      runnable?.let { handler.removeCallbacks(it) }
      val context = appContext.reactContext
      if (context != null) {
        try {
          context.unregisterReceiver(actionReceiver)
        } catch (e: Exception) {
          // Receiver might not be registered
        }
      }
    }

    // 1. Function to START the native stopwatch
    Function("showNotification") { title: String, startTimeMs: Double, isRunning: Boolean, pausedElapsedSecs: Double->
      val context = appContext.reactContext ?: throw Exception("React Context is null")
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      // Create Channel (Required for Android 8+)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(TIMER_CHANNEL_ID, "Active Timer", NotificationManager.IMPORTANCE_MAX)
        channel.description = "Shows the running timer"
        notificationManager.createNotificationChannel(channel)
      }

      // Calculate when the timer theoretically started relative to system boot
      // (Chronometer requires time based on SystemClock.elapsedRealtime())

      runnable?.let { handler.removeCallbacks(it) }

      /* val pauseIntent = Intent(ACTION_PAUSE)
      val pausePendingIntent = PendingIntent.getBroadcast(context, 0, pauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

      val resumeIntent = Intent(ACTION_RESUME)
      val resumePendingIntent = PendingIntent.getBroadcast(context, 1, resumeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

      // Build the Notification
      val builder = NotificationCompat.Builder(context, TIMER_CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm) // You can use a custom icon from drawable
        .setOngoing(true) // User cannot swipe it away
        .setOnlyAlertOnce(true) // Don't vibrate/sound on updates
        .setContentTitle(title)
      
      if (isRunning) {
        val timeSinceStart = System.currentTimeMillis() - startTimeMs.toLong()
        val elapsedRealtime = SystemClock.elapsedRealtime()
        builder.setUsesChronometer(true)
        builder.setWhen(System.currentTimeMillis() - timeSinceStart)
        builder.addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent)
      } else {
        builder.setUsesChronometer(false)
        builder.addAction(android.R.drawable.ic_media_play, "Resume", resumePendingIntent)
      }
      notificationManager.notify(NOTIFICATION_ID, builder.build()) */

      runnable = object : Runnable {
        override fun run() {
          val now = System.currentTimeMillis()
          // Calculate elapsed time manually
          val elapsedMillis = if (isRunning) {
            now - startTimeMs.toLong()
          } else {
            (pausedElapsedSecs * 1000).toLong()
          }

          // Build the notification
          val pauseIntent = Intent(ACTION_PAUSE)
          val pausePendingIntent = PendingIntent.getBroadcast(context, 0, pauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

          val resumeIntent = Intent(ACTION_RESUME)
          val resumePendingIntent = PendingIntent.getBroadcast(context, 1, resumeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

          val stopIntent = Intent(ACTION_STOP)
          val stopPendingIntent = PendingIntent.getBroadcast(context, 2, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

          val builder = NotificationCompat.Builder(context, TIMER_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setOnlyAlertOnce(true) // Crucial: prevents sound/vibration on update
            .setContentTitle(title) // Title stays at the top
            .setContentText(formatTime(elapsedMillis)) // <--- TIME IS NOW IN THE BODY
            .setUsesChronometer(false) // Disable system chronometer
            
          // Add Buttons
          if (isRunning) {
            builder.addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent)
          } else {
            builder.addAction(android.R.drawable.ic_media_play, "Resume", resumePendingIntent)
          }

          builder.addAction(android.R.drawable.ic_menu_add, "Stop", stopPendingIntent)

          // Show it
          notificationManager.notify(NOTIFICATION_ID, builder.build())

          // If running, schedule the next update in 1 second
          if (isRunning) {
            handler.postDelayed(this, 1000)
          }
        }
      }

      // Start the loop immediately
      handler.post(runnable!!)

    }

    // 2. Function to STOP/REMOVE the notification
    Function("stopNotification") {
      val context = appContext.reactContext ?: throw Exception("React Context is null")
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      runnable?.let { handler.removeCallbacks(it) }
      notificationManager.cancel(NOTIFICATION_ID)
    }
  }
}