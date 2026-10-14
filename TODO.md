# General: Can be omitted

- TODO : Custom colors for categories currently only local to devices and dont sync to cloud
- TODO : Maybe keep darkMode as default irrespective of system settings
- TODO : Item Label(Home-screen Today's tasks , events, habits etc) animations, like ads
- TODO : Mayeb add more animations for the app. R&D
- TODO : More settings options
- TODO : Few more achievements
- TODO : Habit successful checkin feedback
- TODO : R&D better Calendar screen, refer google calendar maybe.
- TODO : If tags and categoires are added, embeddings for them?, atleast searchable via physical search, AI handlers also would need to be updated
- TODO : Notifications edits via AI chat
- TODO : Maybe custom notifications options
- TODO : duplicate cateogries get added to UI, and count gets updated in db for exisitng one
- TODO : feeback for habits goal reach and restart option via the Chat

# Fixes Severity : High

- TODO : Toggling Match System Theme crashes app due to hook changes
- TODO : achivement reseting logic and cloud sync combination check how to get it to work or what should to logic
- TODO : completeling task is very laggy
- TODO : Achivements metrics are not being used currently
- TODO : Analytics - if filter leads to no data for that filter, empty tiles are displaed, isntead display soem message or hide tiles or something
- TODO : If due date of task is changed, the notification should be updated, or user should be told to reschedule the notification or something, same with events, probably not habit
- TODO : Home page search is broken right now
- TODO : tag names unique issue, maybe can be psued and pulled that causes error, either ignore duplciate or silently
- TODO : duplicate adds for habitAutoFrozen metric
- TODO : certain charts when rendered in chart-details-modal, need some barWidth, fontSzie, viewPort, domainPadding etc. changes
- TODO : date field managment for multi timezone users CHECK
- TODO : What in case when a user wants to schedule an overnight event, when the start time is later than the end time but of previous date, current logic breaks in case
- TODO : If task is marked complete then notification is cancelled in the AI handler, but not in the task item logic, also if task is then marked incomplete, then a new notificaiton is not scheduled, R&D how it should be ideally
- TODO : CAtch high demand errors nad return a suitable response, catch any other possibel errors too
- TODO : task due date, event startdate and end date are just in (YYYY-MM-DD) format, convert to ISO 8601 format
- TODO : Duplicate category names are allowed to entered and submitted which casues error, NEED TO FIX

# Fixes Severity : Medium

- TODO : Infitely recurring evnets currently are only replicated for 60 days, after that their UI card is not shown in the calendar
- TODO : notification badge for items with notifcation, pressing on the badge should allow to disable notifications for that item
- TODO : habits checkins missed recording duplicates, some id checker is needed for those habits form whom the metric is incremented alrteady and prevent duplicate increments
- TODO : Timer Screen Flip Animation state issues- FIX'em

# Fixes Severity : Low

- TODO : Completed task deletion, either prompt or auto delete after 30 days
- TODO : Calendar item re-design
- TODO : If no cloud data then dont open prompt for mrege or replace, function to check if cloud has data but there is sequencing problem.
- TODO : a recovery snapshot is created even if there is not data

# Must haves

- TODO : Habit auto freeze should be optional and toggleable
- TODO : Codebase updation for iOS
- TODO : Testing on bigger/smaller screens. Test on different devices
- TODO : home page search enhancment or removal. R&D
- TODO : Hnadle hidden achievements
- TODO : cloud data delteion otion in settings
- TODO : local data deltetion option in settings without deleting cloud data
- TODO : Diff Haptic modes for different functions
- TODO : iOS supported hapitcs via useHaptics
- TODO : All haptics should be able to be turned off via settings
- TODO : All Notifications should be pausable/cancellable via settings
- TODO : All sounds must be able to be musted via settings

# Optimization

- TODO : Check for steps required to adapte date/time fields to different Timezones and day light saving time changes
- TODO : Many files are very large, try and make it more modular. ALL FILES HAVE TO CHECKED FOR POSSIBLE
- TODO : new Date() is expensive in javascript so have be to memomized everywhere
- TODO : shifting logic from habit-screen , habit-item, habiit-stats to utils maybe

# Must do before launch

- TODO : Migrate to Interaction API for googlegenAI lib
- TODO : All error handling , every where.
- TODO : add the RevenueCat webhook secret check
- TODO : Some warning or fallback for old versions of iOS and android incompatabile with new versions of libs
- TODO : Every Modal must have close button and must close on pressing back
- TODO : Input sanitization
- TODO : Check for Security enhancements and possible securicty concerns for the entire app
- TODO : Home timeline has to be tweaked, each tasks, timeline feels useless mostly, category based event colors is commneted out for now
- TOOD : Where should GestureHandlerRootView be
- TOOD : Habit checked in from the home page if reached goal, doesnt open modal and it cannot be restarted
- TODO : if a habit is a at a streak 1 , but then you miss a day and check in again later the habit streak is then reset and streak is back to 1 , but there is no UI/visuals for that, it looks like nothing happened when in fact it when to from 1 to 0 then from from 0 to 1 , but it looks as if the check in didnt regsiter

# AI-Based

- TODO : The AI chat always has to have chat history avaliable to it, for example I asked the current chat logic , "how to read a scatter plot", it gave a base explannation on what a scatter plot is but not how to read it, in the follow up , I asked , "yea, but how to read it tho", it answered some bullshit and asked me what "it" is . It forgot what I said before
- TODO : Handler that allows the AI to add a additonal custom System prompt instruction curated by the user
- TODO : Handler that allows the AI to trigger a custom notification with a personalized message to the user (for reminders, encouragement, etc)
- TODO : Add a "reasoning" field to the handler calls, so that when we log them, we can also log the AI's reasoning for why it called that tool, which will be helpful for debugging and future training/fine-tuning
- TODO : Add error handling and edge case handling for each handler, and log any errors that occur during execution, so that we can identify common failure points and improve the system over time.
- TODO : Confidence field like response and reasoning
- TODO : Add a handler so AI can access chat history and use it as context for future responses
- TODO : delete-event_instance(id, date[]), - freeze-habit(id) handlers
- TODO : Query handler should be able to query based on categories and tags
- TODO : searchTaxonomy handler should be able to return all categories and tags, currently its not able to handle query type of all
- TODO : Maybe handler for cloud syncing via AI chat
- TODO : handler for theme management via AI chat
- TODO : for opening color picker via AI chat

# NEW

- TOOD : Check error handling for AI handlers so that AI can asnwer what wnet wrong
- TODO : Sync loading should have a mention that its syncing
- TODO : This error still happens : [sync] Failed to push categories: {"code": "PGRST303", "details": null, "hint": null, "message": "JWT issued at future"}
- TODO : UI indicator taht item has a notificaiton setup
- TODO : Check how are tombstones pruned eventually or do they stay forever
- TODO : Sync interval changes via settings,
- TODO : first time device sigin throws [SyncProvider] Sync failed: [Error: Call to function 'NativeStatement.runSync' has been rejected. → Caused by: Error code : FOREIGN KEY constraint failed] , check why and fix
- TODO : I think pressing sync now button doesnt addiitonally refresh in app items , check for other syncs too
- TODO : New sync error : Error: Uncaught (in promise, id: 1) Error: Call to function 'NativeStatement.runSync' has been rejected.
  → Caused by: Error code : UNIQUE constraint failed: habit_check_ins.id, I think this happens because in supabase child tables arent stored, so when a habit is autofrozen, habit row changes its updatedAt and the data is then pushed to clud, now when another device pulls in data, as both devices had the same check ins table, the pull rebuilds the same data and tries to insert it in habit item, which then obviously causes a sync error, I think the there will the same issue if both unsynced devices checkin the same habit and then try to sync to cloud, so this has to be fixed
- TODO : in edit modals, when no category is assigned, 'None Selected' which rendered earlier doesnt show up
- TODO : Additonal confirmation after successfull deletion of big deletes, like reset achievements currently after reset is pressed , shows no confirmation that the "Achievements Reset Successfully" , I think that is a must and good to have
  -TODO : Notificaiton rescheduler , check once . On app reload when all data is pulled in then too the rescheduler modal is shown, even tho there not be any new notificaitions

# Big Overhaul #1 (BO1): Upgrade Sync Engine to Event-Driven, Selective Sync

**Goal:** Replace reliance on periodic full sync cycles with an intelligent sync coordinator that reacts to local changes, batches work, and synchronizes only what is necessary.

### Planned changes

1. **Repository change notifications:** Emit notifications after successful local mutations, identifying the affected entity types (Tasks, Tags, Habits, etc.). Treat these as wake-up signals, not the source of truth for dirty state.

2. **Debounced sync scheduler:** Add a central `requestSync()` mechanism that batches rapid changes (e.g. wait 1–3 seconds), prevents concurrent syncs, and queues a follow-up run if changes occur during an active sync.

3. **Selective push execution:** Use existing `updatedAt`/`syncedAt` dirty-state tracking to identify pending records. Query dirty rows directly in SQLite instead of loading entire tables into memory, and skip entity types with no pending changes.

4. **Selective pull execution:** Continue incremental pulls using the server-managed `server_updated_at` watermark. Run pulls when scheduled, on app foreground/connectivity recovery, or when a remote-change notification indicates new data.

5. **Post-pull reconciliation push:** If Tag/Category collision resolution modifies item references during pulling, conditionally push Tasks, Habits, Events and Logs again after all pulls finish.

6. **Fallback and reliability:** Keep periodic sync (e.g. every 5 minutes) as a safety net. Ensure failures retain dirty state, pending requests are not lost, and cursors advance only after successful pulls.

7. **Optional later enhancement — Supabase Realtime:** Subscribe to remote changes to trigger sync sooner, while retaining periodic sync for missed notifications and offline recovery.

### Complexity / estimate

**Medium-sized upgrade — approximately 1–3 focused days** for the scheduler, selective execution and integration; allow **3–5 days** for thorough testing, race-condition handling and cross-device verification.

**Recommended order:** Fix post-pull pushing first; implement the debounced scheduler and pending-run handling next; optimize dirty-row queries; add Realtime only if needed. Test offline edits, simultaneous device changes, collisions, failed syncs and app backgrounding.

## Big Overhaul #2 (BO2) (MUST-DO): Upgrade the native timer notification

**Goal:** Make the sticky timer notification reliable and cheap by letting Android render the ticking time, and make its buttons work even when the app process is gone. Batch all native changes into as few 5–10 minute rebuilds as possible.

### Current problems this fixes

- The notification re-posts itself every second from a main-thread loop inside the app process. If Android freezes or kills the process, the time freezes and the buttons stop working until the app is reopened.
- Countdown mode shows elapsed time, not remaining time.
- Tapping the notification doesn't open the app, and the first post pops a heads-up banner.

### Planned changes

1. **Spike the chronometer first (one build).**
   - Test stopwatch with `setUsesChronometer(true)`, `setWhen(startedAtMs)` and `setShowWhen(true)`, plus a static `setContentText` for the paused state.
   - Try it on at least two device brands and Android 12–15.
   - Keep the current manual loop as a fallback behind a flag, since the earlier chronometer attempt was abandoned for an unknown reason.
2. **Countdown.**
   - Use `setChronometerCountDown(true)` with `setWhen(endAtMs)`.
   - The chronometer counts up after zero, so add `setTimeoutAfter(remainingMs)` (API 26+) to remove the notification, and keep the existing scheduled "Time's up" notification.
3. **Replace the positional arguments with one descriptor.**
   - Fields: `{ title, mode, isRunning, startedAtMs, endAtMs, elapsedMs }`.
   - Update `syncNotification` in `timer-actions.ts` and the `modules/notifications-timer` wrapper.
   - Keep it platform-neutral so the iOS module can implement it differently.
4. **Buttons handled natively.**
   - On a button press, update the notification immediately, then emit the JS event.
   - Persist a queue of `(action, timestamp)` pairs in SharedPreferences.
   - Register the receiver in the module's `AndroidManifest.xml`, and add `setPackage` to the action intents.
   - Add `drainPendingActions()` for `initTimerBridge()`, applying each action at its original timestamp via `begin(now)` or `halt(now)`.
5. **Notification polish.**
   - Content intent that opens the app.
   - A new `LOW` importance channel id, deleting the old one.
   - Stopwatch category, custom small icon, and a proper Stop icon.
6. **Lifecycle and permission.**
   - Decide what `OnDestroy` does. If state is persisted and the chronometer is used, leaving the notification up is fine.
   - Make `showNotification` return whether notifications are enabled, so
