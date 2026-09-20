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
