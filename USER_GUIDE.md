# Anbyans — Complete User Guide

**Platform:** anbyans.events  
**Languages:** English / Kreyòl Ayisyen  
**Roles:** Fan · Organizer · Vendor/Reseller · Admin

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Creating an Account](#2-creating-an-account)
3. [Fan Guide](#3-fan-guide)
4. [Organizer Guide](#4-organizer-guide)
5. [Vendor / Reseller Guide](#5-vendor--reseller-guide)
6. [Admin Guide](#6-admin-guide)
7. [Payment Methods](#7-payment-methods)
8. [Ticket Transfers](#8-ticket-transfers)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Platform Overview

Anbyans is a bilingual (English / Haitian Creole) event ticketing platform built for the Haitian diaspora community. It supports:

- **Fans** buying tickets to events
- **Organizers** creating and managing events, staff, and resellers
- **Vendors/Resellers** buying tickets in bulk and reselling to customers
- **Admins** overseeing the entire platform

Payment methods include MonCash, Natcash, Stripe (card), Zelle, PayPal, and Cash App. Prices display in both USD and HTG with a configurable exchange rate.

---

## 2. Creating an Account

### Fan Account
1. Go to **anbyans.events/auth**
2. Click the **Register** tab
3. Select the **Fan (🎫)** role
4. Fill in: First Name, Last Name, Email, Phone, City, State, Country
5. Create a password (must be 6+ characters; a strength indicator shows as you type)
6. Opt in to notifications: WhatsApp, SMS, and/or Email
7. Check the box to agree to the Terms of Service and Privacy Policy
8. Click **Create Account**
9. You will see a success screen — click **Find Events** to start browsing

> You can also sign in with Google. If it's your first time, a fan account is created automatically.

### Organizer Account
1. Go to **anbyans.events/organizer/auth**
2. Click the **Register** tab
3. Fill in:
   - First Name, Last Name
   - **Business Name** (required)
   - **Business Type**: Promoter, Venue, Artist, Sports, Non-profit, or Religious
   - Email, Phone, City, State, Country
   - **Payout Method**: MonCash, Natcash, Stripe, Bank, Zelle, PayPal, or Cash App
   - Payout Account Details
4. Create a password and confirm it
5. Agree to Terms of Service
6. Click **Create Account**
7. You will be taken to your organizer dashboard

### Vendor / Reseller Account
1. Go to **anbyans.events/vendor/auth**
2. Click the **Register** tab
3. Fill in: First Name, Last Name, Business Name, Email, Phone, City, Country, Payout Method, Payout Account Details
4. Create and confirm a password, agree to Terms
5. Click **Create Account** → you are taken to your vendor dashboard

> Vendors can also be invited directly by an organizer via a WhatsApp invitation link. That link takes you to **/vendor/join** where the form is pre-filled with the organizer's info.

---

## 3. Fan Guide

### 3.1 Browsing Events

1. Go to **anbyans.events/events**
2. Use the **search bar** to search by event name, city, or tag
3. Filter by: **All** | **Live Now** (● pulsing red) | **Upcoming**
4. Each event card shows:
   - Cover image or emoji
   - Live badge if currently happening
   - Title, Date, Location
   - Price range (lowest to highest ticket price)
5. Click **Browse →** on any card to open the event

### 3.2 Buying Tickets

Ticket purchase is a 5-step flow.

#### Step 1 — Event Details
- Review the event: title, dates, times, venue, description, map
- See section availability:
  - **Green bar** = plenty of seats
  - **Orange bar** = fewer than 20% remaining
  - **Red / Sold Out** = no tickets available
- For each section: name, price (USD + HTG), seats remaining, type (General Admission or Reserved Seats)
- Use the **± buttons** to set quantity (max 10 per section)
- The sticky bar at the bottom shows: ticket count, service fee, total in USD and HTG
- Click **Continue** when ready

#### Step 2 — Seat Selection (Reserved sections only)
- A seat map appears showing rows A–J and columns 1–10
- **Light blue** = available, **Orange** = your selected seat, **Dark gray** = taken
- Click seats to select them (one per ticket)
- Click **Confirm seats (X)** to proceed

#### Step 3 — Your Information
- Enter: Full Name (required), Phone (required), Email (optional)
- Review the cart summary: sections, quantity, seats, prices, service fee, total
- Click **Continue**

#### Step 4 — Payment Method
Choose your payment method:

- **MonCash / Natcash**: Send the exact amount shown to the number displayed. Enter your Transaction ID in the field provided. Click **Confirm Payment**. Your ticket is pending until the organizer verifies it.
- **Stripe (Card)**: Enter your card details in the secure Stripe form. Click **Pay with Card →**. Payment is instant and your ticket is confirmed immediately.
- **Cash / Zelle / CashApp**: Your order is placed as pending. Contact the organizer using the account info shown to complete payment. Organizer confirms manually.

#### Step 5 — Confirmation
- **Stripe payments**: "Order Confirmed! 🎉" — ticket codes shown immediately
- **Cash/MonCash payments**: "Order Pending" — your ticket is confirmed once the organizer verifies payment
- Ticket codes are shown in orange monospace text
- Click **View Ticket** to open your ticket, or **Back to Events** to keep browsing

### 3.3 Viewing Your Tickets

1. Go to **anbyans.events/tickets**
2. If logged in, your tickets load automatically
3. If not logged in, enter your **Phone** and **4-digit PIN** to look up tickets
4. Each ticket shows:
   - Event name, section, seat
   - Date and time
   - Status: **Valid** (green) | **Used** (orange) | **Pending Transfer** (amber) | **Cancelled** (red)
5. Click any ticket to open its QR code view at **/ticket/[code]**
6. Show the QR code to staff at the door to be admitted

### 3.4 Transferring a Ticket

You can transfer a valid ticket to someone else:

1. Go to **anbyans.events/tickets**
2. Find the ticket and click **🔄 Transfer This**
3. Enter the recipient's **Name** and **Phone number**
4. Click **🔄 Send Transfer**
5. A WhatsApp message with an acceptance link is sent to the recipient
6. The recipient has **24 hours** to accept at **/transfer/[token]**
7. Once accepted, the ticket is in their name
8. **Note:** Transfers cannot be undone once accepted

> If you change your mind before the recipient accepts, click **⏳ Awaiting acceptance** on the ticket to cancel the transfer.

---

## 4. Organizer Guide

### 4.1 Dashboard Overview

After logging in, you land on **anbyans.events/organizer/dashboard**.

The header shows:
- **Event Selector** (top center): Switch between viewing All events or a specific event
- **Language Switcher**: Toggle between English and Haitian Creole
- **Profile Button** (top right): Your name, initials/logo, and "Òganizatè" label — click to open the profile menu

The sidebar has:
- 📊 Dashboard
- 📅 Events
- 🏪 Resellers
- 💰 Revenue
- 📈 Analytics
- 👥 Staff
- ⏳ Pending Tickets
- ⚙️ Settings

**KPI Cards (4 columns):**
| Card | What it shows |
|------|--------------|
| Total Revenue | All ticket sales in USD and HTG |
| Tickets Sold | Total valid tickets + active event count |
| Active Events | Published/Live events vs. total |
| Resellers Owe | Amount resellers owe you (orange = action needed) |

Below the cards:
- **Live Admission Counter**: Real-time count of how many people have been scanned in at the door, with a progress bar
- **Quick Actions**: Scan Tickets, Manage Resellers, Manage Staff, View Revenue
- **Events Table**: Name, date, status, ticket count, revenue
- **Recent Sales**: Latest ticket purchases with time, event, source, buyer, and price

### 4.2 Creating an Event

Go to **Events → Create Event** or click the **➕ Create Event** button.

The form has 3 tabs:

#### Tab 1 — Event Details
| Field | Required | Notes |
|-------|----------|-------|
| Event Name | ✓ | |
| URL Slug | ✓ | Auto-generated from the name. This becomes the event URL: anbyans.events/e/[slug] |
| Start Date | ✓ | Date picker |
| Start Time | | Default: 20:00 |
| End Date | | Must be on or after start date |
| End Time | | Default: 23:00 |
| Cover Image | | Paste an image URL — preview appears automatically |
| Description | | Multi-line text |
| Private Event | | Toggle 🔒 — only invited guests can buy tickets |

#### Tab 2 — Venue & Sections

**Venue:**
- Type into the venue search — suggestions load from Google Places
- Select your venue; address, city, and GPS coordinates fill in automatically
- A Google Map preview appears confirming the location

**Floor Plan (optional):**
- Upload a floor plan image (drag-drop or click to browse)
- After upload, drag section blocks onto the map to show buyers where each section is located
- Each section block is labeled with its name and price
- Use the corner handle to resize, × to remove

**Sections (Ticket Types):**

Click **+ Add Ticket Type** to add a section. For each section:
| Field | Notes |
|-------|-------|
| Name | e.g., VIP, General, Floor, Balcony |
| Color | Choose from 8 color swatches — used on tickets and floor plan |
| Price (USD) | Ticket price; HTG equivalent shown automatically |
| Capacity | Max tickets for this section |
| Type | 🎫 General Admission or 💺 Reserved Seats |
| Vendor Price | Optional — bulk price for resellers |
| Vendor Open/Close Date | Date window when resellers can buy for this section |

Click **Draw zone on floor plan** to link the section to a region on your floor plan image.

A summary box at the bottom shows all sections with prices (USD and HTG), capacities, and total capacity.

#### Tab 3 — Payment Methods

- **Exchange Rate**: Set how many HTG equal 1 USD (e.g., 130). This controls how prices display to buyers.
- **Toggle each payment method** on or off:
  - MonCash: Enter your MonCash phone number
  - Natcash: Enter your Natcash phone number
  - Stripe: Connected in Settings (see Section 4.7)
  - Zelle / PayPal / CashApp: Enter your account handle/email

When done, click **Publish** in the bottom bar. Your event is live at anbyans.events/e/[slug].

### 4.3 Managing Events

Go to **Events** in the sidebar. Each event card shows:
- Title, status badge, date, ticket count, capacity progress, revenue
- Click a card to expand it

**Expanded actions:**
| Button | What it does |
|--------|-------------|
| ✏️ Edit | Opens the 3-tab edit form |
| 👥 Staff | Goes to Staff → this event's assignments |
| 📷 Scanner | Opens the ticket scanner for this event |
| 📋 Copy Private Link | Copies the invite-only URL (private events only) |
| ● Go Live | Changes status from Published → Live |
| ■ End Event | Closes ticket sales and marks event as ended |
| ↺ Reopen | Re-publishes an ended event |

**Event statuses:**
| Status | Badge | Meaning |
|--------|-------|---------|
| Draft | Gray | Not visible to fans |
| Published | Cyan | Visible to fans, tickets on sale |
| Live | Green ● | Event is happening now |
| Ended | Gray | Event is over, sales closed |

### 4.4 Verifying Pending Payments

When buyers pay via MonCash, Natcash, or Cash, their tickets appear as **Pending** until you verify.

Go to **⏳ Pending Tickets** in the sidebar.

**Top summary cards:**
- MonCash/Natcash pending count (need transaction verification)
- Cash pending count (need manual confirmation)
- Total pending value in HTG

**For each pending ticket:**
- Buyer name, phone, email
- Event, section, seat
- Amount (USD + HTG)
- Transaction ID (MonCash/Natcash)
- Payment method badge

**Actions:**
- ✓ **Approve** — validates the ticket; buyer can now use it
- ✕ **Reject** — cancels the order

> Best practice: For MonCash/Natcash, verify the transaction ID in your MonCash/Natcash app before approving.

### 4.5 Managing Resellers / Vendors

Go to **🏪 Resellers** in the sidebar.

**3 tabs:**

**My Resellers:**
- View all resellers assigned to your events
- Filter by status (Active, Inactive, Pending) or by event
- Each reseller card shows: name, status, contact info, events, sales stats
- Actions: Edit commission %, Suspend, Remove

**Available Resellers:**
- Browse resellers on the platform who are not yet assigned to your events
- Click **Assign** to add them to your roster

**Pending Requests:**
- Resellers who have requested to sell your events
- Click **Approve** — a WhatsApp confirmation is sent to the reseller automatically
- Click **Deny** to decline

**Inviting a new reseller:**
- Click **Invite Reseller**
- Enter: Name, Contact, Phone, City, Payout method
- Click **Send via WhatsApp** — the reseller receives a link to **/vendor/join** with your info pre-filled

### 4.6 Staff Management

Go to **👥 Staff** in the sidebar.

**4 tabs:**

**Overview:**
- Total active staff count, breakdown by role
- Quick-add form: Name, Phone, role

**Staff Pool:**
- All staff members available for your events
- Each person: Name, phone, PIN, assigned roles
- Add new staff or remove existing

**Assignments (per event):**
Assign staff to specific events with role-specific settings:

| Role | What they can do | Settings available |
|------|-----------------|-------------------|
| Scanner | Scan QR codes at entry | Device lock, allowed sections, override permission |
| Door | Manual door admission | Entrance selection, capacity visibility |
| Sales | Sell tickets on-site | Commission %, allowed sections, payment methods, target |
| Security | Monitor zones | Zone selection, incident access, eject permission |
| F&B | Food & beverage sales | Categories, sales logging, cash handling |
| Manager | Full dashboard view | All permissions |

**Performance:**
- Stats per staff member: scans processed, admissions, sales generated

### 4.7 Scanning Tickets at the Door

Go to **📷 Scanner** in the sidebar or from an event's expanded card.

1. **Enter your PIN** (4 or 6 digits, set in Settings)
2. Choose a staff member (if you are the organizer logging in as yourself, skip)
3. The scanner view opens:
   - Point the camera at a fan's QR code, or type the ticket code manually
   - Results appear instantly:
     - ✅ **Admitted** — valid ticket, first scan
     - ⚠️ **Already Used** — ticket was scanned before
     - ❌ **Not Found** — code doesn't exist
   - Scan history shows the last 10 scans with time, buyer name, section, and status
   - Live counter shows total admitted so far
4. Works offline — scans queue locally and sync when reconnected

### 4.8 Revenue & Analytics

**Revenue** (💰 in sidebar):
- Toggle: All Events or a specific event
- Cards: Total Revenue, Online Revenue, Vendor Revenue, Vendor Amounts Owed
- **Daily Sales Chart**: Bar chart for the last 14 days
- **Section Breakdown**: Tickets sold per section
- **Vendor Payments Table**: Who owes what, with Pay / Mark as Paid buttons
- **Refund Requests**: Approve or deny pending refunds

**Analytics** (📈 in sidebar):
- Cards: Total Buyers, Loyal Buyers (2+ events), Tickets Sold, Avg Spend per Buyer

Sub-tabs:
| Tab | Shows |
|-----|-------|
| Top Spenders | Ranked buyers by total amount spent |
| Loyal Buyers | Ranked by number of events attended |
| Sections | Tickets sold per section (bar chart) |
| Events | Revenue per event |
| Vendors | Revenue generated by each reseller |

### 4.9 Organizer Settings

Go to **⚙️ Settings** in the sidebar. 5 tabs:

#### Profile
- Upload your business logo (click to browse; image is compressed automatically)
- Business Name, Email, Phone, Website
- Click **Save**

#### Payments
- **Exchange Rate**: Set 1 USD = X HTG (affects how prices display)
- **Toggle each payment method** and enter account details:
  - MonCash, Natcash: Enter phone number
  - **Stripe**: Click **Connect Stripe** → you are redirected to Stripe's onboarding to set up your Express account. Once approved, card payments go directly to your bank via Stripe.
  - Zelle: Email or phone
  - PayPal: Email
  - Cash App: $cashtag
- Click **Save**

#### Scanner
- Default event for the scanner
- Scan mode: **Single** (confirms each scan) or **Continuous** (rapid scanning)
- Sound, vibration, and buyer name display toggles

#### Staff Defaults
- PIN length: 4 or 6 digits
- PIN expiry: Never, After event ends, or After 30 days
- Auto-deactivate staff when event ends
- Allow scanner staff to override a flagged ticket
- Require device lock
- Default sections staff can access

#### Notifications
| Notification | When it fires |
|-------------|---------------|
| Staff Activated | A staff member logs into the scanner |
| Low Capacity | Remaining tickets fall below your threshold % |
| New Sale | A ticket is purchased |
| Incident Report | A security staff member logs an incident |

- **Channel**: Email, WhatsApp, or Both

---

## 5. Vendor / Reseller Guide

### 5.1 Dashboard Overview

After logging in at **anbyans.events/vendor**, you see your dashboard with 5 tabs:

**Sell | Buy | Inventory | Sales | Events**

### 5.2 Buying Tickets in Bulk (Buy Tab)

1. Select an **Event** from the dropdown
2. Select a **Section**
3. Enter the **Quantity** you want to purchase (1–1,000)
4. See the bulk pricing tiers — buying more may unlock a lower price per ticket
5. Review the total cost in USD and HTG
6. Click **Confirm** — a confirmation code is shown and your ticket inventory is updated

> Bulk purchasing is only available during the vendor window set by the organizer (open date → close date per section).

### 5.3 Selling Tickets to Customers (Sell Tab)

1. Select the **stock** you want to sell from (event + section + qty owned)
2. Enter the buyer's **Name** and **Phone**
3. Scan a QR code or enter a ticket code to assign it, or let the system auto-assign
4. Confirm the sale — ticket codes are shown for the buyer
5. Recent sales appear in a list below

### 5.4 Inventory Tab

- **Summary**: Total tickets bought, sold, remaining across all events
- **Per-event breakdown**: Event name, section, qty bought, qty sold, qty remaining, profit per ticket

### 5.5 Sales Tab

- Full sales history
- Filter by event and date range
- Shows: event, section, quantity sold, price charged, profit

### 5.6 Events Tab

- Browse all events you can sell for
- Status per event: **Approved**, **Pending Request**, **Denied**
- Click **Request Access** for events you want to sell but haven't been assigned to yet
- See bulk pricing info per section

### 5.7 Profile & Settings

Go to your **Profile** page:
- Business name, contact info, phone, city
- Payout method and account details
- Click **Save**

---

## 6. Admin Guide

### 6.1 Accessing the Admin Dashboard

Go to **anbyans.events/admin/dashboard**. Admin access requires an account with the `admin` role — contact the platform owner to be granted access.

### 6.2 Dashboard Tabs

#### Overview
- **KPI Cards**: Total events, total platform revenue, active organizers, total users
- System status indicators
- Recent activity feed

#### Events
- Full searchable list of all events on the platform
- Shows: Event name, organizer, status, revenue
- **Actions**: Toggle Published ↔ Cancelled, Delete event

#### Organizers
- Searchable list: Name, email, business type, event count, revenue
- **Actions**: Suspend / Unsuspend organizer, View details

#### Users
- Searchable list: Name, email, role, city, country
- **Actions**: Suspend / Unsuspend user, View details

#### Refunds
- All pending refund requests from buyers
- Shows: Buyer name, amount, reason
- **Approve**: Processes the refund
- **Deny**: Opens a modal to enter a denial reason (sent to buyer)

#### Finance
- Platform-wide revenue metrics
- Pending and completed payouts to organizers
- Platform fee collection summary

#### Venues
- Create, edit, and delete venues
- Fields: Name, address, city, capacity
- Upload floor plans for each venue
- Floor plans are available to organizers when creating events
- **Seed Venues** button: Pre-populates a list of known venues

#### Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Platform Fee | 9% | Service fee added to each ticket |
| Reserve Requirement | — | % of revenue held in reserve |
| Payout Delay | — | Days after event before organizer payout is released |

---

## 7. Payment Methods

| Method | Who sets it up | How buyer pays | How organizer receives |
|--------|---------------|---------------|----------------------|
| **MonCash** | Organizer enters phone in Settings | Buyer sends HTG to that number, enters Transaction ID | Organizer verifies Transaction ID and approves ticket |
| **Natcash** | Organizer enters phone in Settings | Same as MonCash | Same as MonCash |
| **Stripe (Card)** | Organizer connects Stripe Express account in Settings | Buyer enters card — payment is instant | Funds deposited to organizer's bank via Stripe |
| **Zelle** | Organizer enters email/phone in Settings | Buyer sends USD via Zelle | Organizer confirms and approves ticket |
| **PayPal** | Organizer enters email in Settings | Buyer sends via PayPal | Organizer confirms and approves ticket |
| **Cash App** | Organizer enters $cashtag in Settings | Buyer sends via Cash App | Organizer confirms and approves ticket |

**Exchange Rate**: All prices show in USD. When an organizer sets an exchange rate (e.g., 1 USD = 130 HTG), prices automatically display in both currencies everywhere on the platform.

**Platform Fee**: A service fee (default 9%) is added to each ticket at checkout. This goes to Anbyans.

---

## 8. Ticket Transfers

Fans can transfer valid tickets to another person before the event:

1. Go to **anbyans.events/tickets**
2. Find the ticket → click **🔄 Transfer This**
3. Enter recipient's **Name** and **Phone**
4. Click **🔄 Send Transfer**
5. The recipient gets a WhatsApp message with a link to accept
6. Recipient accepts at **/transfer/[token]** within 24 hours
7. Ticket is now in the recipient's name

**Rules:**
- Only valid (unused, non-cancelled) tickets can be transferred
- Transfers cannot be undone once the recipient accepts
- You can cancel a pending transfer before it is accepted

---

## 9. Troubleshooting

| Issue | Fix |
|-------|-----|
| Page spinning on load | Wait 5–10 seconds for Firebase to initialize. If it persists, hard-refresh (Cmd+Shift+R) |
| Profile button not showing | Hard-refresh the page. If still missing, log out and back in |
| Logo not showing after upload | Go to Settings → Profile → re-upload the logo and click Save |
| Ticket says "Pending" | Organizer needs to verify your payment in the Pending Tickets section |
| Can't scan tickets | Check that the correct event is selected in Settings → Scanner |
| Stripe Connect not working | Complete all steps in Stripe's onboarding. Charges only activate after Stripe approves your account |
| MonCash payment rejected | Ensure the Transaction ID entered matches exactly what appears in your MonCash app |
| Vendor bulk purchase failing | Check that the vendor window (open/close date) is active for that section |
| Transfer link expired | Transfers expire after 24 hours — the original ticket is returned to you. Initiate a new transfer |

---

*Guide version: May 2026 — Anbyans v0.1*
