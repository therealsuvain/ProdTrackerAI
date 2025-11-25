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
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationsTimerModule : Module() {
  private val TIMER_CHANNEL_ID = "timer_channel"
  private val NOTIFICATION_ID = 1
  private val ACTION_PAUSE = "expo.modules.notificationstimer.PAUSE"
  private val ACTION_RESUME = "expo.modules.notificationstimer.RESUME"

  // 1. The Receiver: Listens for button clicks from the Notification
  private val actionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val action = intent.action
      // Emit event to React Native so the App can update its state
      if (action == ACTION_PAUSE) {
        sendEvent("onPauseAction")
      } else if (action == ACTION_RESUME) {
        sendEvent("onResumeAction")
      }
    }
  }
  override fun definition() = ModuleDefinition {
    Name("NotificationsTimer")
    // Define events we will send to JS
    Events("onPauseAction", "onResumeAction")

    // Register the receiver when the module loads
    OnCreate {
      val context = appContext.reactContext
      if (context != null) {
        val filter = IntentFilter().apply {
          addAction(ACTION_PAUSE)
          addAction(ACTION_RESUME)
        }
        ContextCompat.registerReceiver(context, actionReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
      }
    }

    // Cleanup when module is destroyed
    OnDestroy {
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
        val channel = NotificationChannel(TIMER_CHANNEL_ID, "Active Timer", NotificationManager.IMPORTANCE_LOW)
        channel.description = "Shows the running timer"
        notificationManager.createNotificationChannel(channel)
      }

      // Calculate when the timer theoretically started relative to system boot
      // (Chronometer requires time based on SystemClock.elapsedRealtime())

      val pauseIntent = Intent(ACTION_PAUSE)
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
        // Mode: Running
        // Calculate base for Chronometer
        val timeSinceStart = System.currentTimeMillis() - startTimeMs.toLong()
        val elapsedRealtime = SystemClock.elapsedRealtime()
        
        builder.setUsesChronometer(true)
        builder.setWhen(System.currentTimeMillis() - timeSinceStart)
        
        // Add PAUSE button
        builder.addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent)
      } else {
        // Mode: Paused
        // Show static time
        builder.setUsesChronometer(false)
        // We set 'When' to the timestamp representing the paused duration
        // Note: Formatting "HH:MM:SS" on paused notifications usually requires setContentText manually
        // For now, we will let the system handle the timestamp display
        
        // Add RESUME button
        builder.addAction(android.R.drawable.ic_media_play, "Resume", resumePendingIntent)
      }
      // Show it (ID 1 is used to identify this specific notification)
      notificationManager.notify(NOTIFICATION_ID, builder.build())
    }

    // 2. Function to STOP/REMOVE the notification
    Function("stopNotification") {
      val context = appContext.reactContext ?: throw Exception("React Context is null")
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.cancel(NOTIFICATION_ID)
    }
  }
}