# Manual Fix for HostelId Mismatch

## Problem
Your data has inconsistent hostelId values:
- Hostel ID in hostels array: `1762221647747`
- HostelId in users/tenants/rooms: `1762221623956`

## Solution
You need to update your data.json file to make all hostelId values consistent.

## Option 1: Update all entities to use the hostel's actual ID
Change all occurrences of `"hostelId": "1762221623956"` to `"hostelId": "1762221647747"`

## Option 2: Update the hostel ID to match the entities
Change the hostel's `"id": "1762221647747"` to `"id": "1762221623956"`

## Recommended: Option 1
Update these records in your data.json:

1. **Users array** - Change:
   ```json
   "hostelId": "1762221623956"
   ```
   To:
   ```json
   "hostelId": "1762221647747"
   ```

2. **Tenants array** - Change:
   ```json
   "hostelId": "1762221623956"
   ```
   To:
   ```json
   "hostelId": "1762221647747"
   ```

3. **Rooms array** - Change:
   ```json
   "hostelId": "1762221623956"
   ```
   To:
   ```json
   "hostelId": "1762221647747"
   ```

4. **HostelRequests array** - Update the hostelId field to match

After making these changes, restart your server and try logging in again.