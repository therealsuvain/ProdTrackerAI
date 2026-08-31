# Data changes:

For any new field or table:

1. The sqlite local schema has to be updated
2. The repository fucntions @db/repositories have to be updated
3. The coded types may have to be changed based on what's being added
4. The AI chat tool definitions may have to changed as well, if the tool defintions have to changed then all steps from AI changes have to be done
5. If its a shared field or table that has to be avalabile in cloud then supabase schema has to be changed
6. pull and push functions @utils/Account-utils for cloud have to changed
7. save and restore snapshot functions @utils/Account-utils have to changed

# AI Changes:

If new tool has to added/ existing changed then:

1. tool-def-buckets has to changed/updated
2. tool-schemas have to changed/updated
3. tool-index has to changed(maybe)/updated
4. system-context for serializing data may have to be changed/updated
5. The modal-factory-utils for creating entity objects may have to changed/updated
6. Search/Query/Stats Handlers may need updates
