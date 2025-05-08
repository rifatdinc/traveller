# How to Run the Check-in System Setup Script in Supabase

Follow these steps to execute the SQL script in your Supabase project:

## 1. Login to Supabase Dashboard

- Go to https://app.supabase.com/
- Login to your account
- Select the TravelPoints project

## 2. Navigate to SQL Editor

- From the left sidebar, click on "SQL Editor"
- Click on "New Query" to create a new SQL query

## 3. Execute the SQL Script

- Open the `setup_checkin_system.sql` file from the scripts folder
- Copy the entire content of the file
- Paste it into the SQL Editor in Supabase
- Click the "Run" button to execute the script

## 4. Verify Table Creation

After running the script, you should see several new tables in your database:

- `user_checkins`: Stores records of when users check in to places
- `points_history`: Records points awarded to users
- `user_challenge_progress`: Tracks user's progress on challenges

To verify, go to "Table Editor" in the Supabase dashboard and check if these tables appear in the list.

## 5. Test Functionality

You can test the functionality by:

1. Creating a new check-in through your app
2. Verifying the `visited_by` counter is incremented in the places table
3. Checking that the user's points are recorded in the points_history table

## Troubleshooting

If you encounter any errors when running the script:

1. Check if the referenced tables (`places`, `challenges`, `challenge_requirements`) already exist
2. Make sure your database has the `uuid-ossp` extension enabled (for the `uuid_generate_v4()` function)
3. If you get permission errors, make sure you're executing the script as the database owner

## Additional Setup

The script creates Row Level Security (RLS) policies to ensure data security. Users will only be able to access:

- Their own check-ins
- Their own points history
- Their own challenge progress

If you need admin access to all records, you'll need to create additional policies or use the service role when accessing the database from the server-side.
