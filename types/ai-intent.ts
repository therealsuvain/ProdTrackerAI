export type AIIntent = {
    intent : 'add_task' | 'edit_task' | 'delete_task' | 'complete_task'|
    'add_event' | 'edit_event' | 'delete_event'|
    'add_habit' | 'edit_habit' | 'delete_habit' | 'checkin_habit'|
    'add_log'|'edit_log'| 'delete_log'|
    'start_timer'| 'stop_timer' | 'search';
    params: Record<string, any>;
}