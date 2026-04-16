# Sales Dashboard Application - User Guide

Welcome to the Sales Dashboard Application! This guide will help you use all the features of this system. Don't worry if you're not tech-savvy – we've designed everything to be simple and easy to understand.

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Managing Customers](#managing-customers)
3. [Creating Bill Entries](#creating-bill-entries)
4. [Editing Bill Entries](#editing-bill-entries)
5. [Generating Invoices](#generating-invoices)
6. [Making Payments](#making-payments)

---

## Dashboard Overview

### What is the Dashboard?

The Dashboard is your main control center. When you log in, it shows you a quick summary of important business information at a glance. Think of it as your business health check!

### Information You'll See

#### 1. **Key Numbers (KPI Cards)**
These are highlighted boxes showing important metrics:

- **Total Revenue** - The total amount of money your business has earned. You can see:
  - Daily revenue (how much you earned today)
  - Weekly revenue (how much you earned this week)
  - Monthly revenue (how much you earned this month)

- **Total Customers** - The count of all your active and inactive customers

- **Active Customers** - How many customers are currently active with your services

- **Recent Transactions** - Latest payment or invoice activities

#### 2. **Charts and Graphs**
Visual representations of your data:

- **Revenue Chart** - A line or bar chart showing how your revenue is trending over time (daily, weekly, monthly)

- **Customer Distribution** - A pie chart showing how customers are distributed by type:
  - Bandwidth customers
  - Channel Partner customers
  - SOHO/Home customers

- **Outstanding Invoices** - Shows unpaid or partially paid invoices that need attention

#### 3. **Quick Action Items**
- Alert icons showing any issues that need attention
- A refresh button to update all the information

### How to Use the Dashboard

1. The dashboard updates automatically every 5 minutes
2. You can manually refresh by clicking the refresh button to see the latest data immediately
3. All numbers shown use Bangladesh Taka (৳) as the currency

---

## Managing Customers

### What are Customers?

Customers are the businesses or individuals you provide services to. Each customer can have different types of services (like Bandwidth, Channel Partnerships, or SOHO packages).

### Types of Customers

1. **Bandwidth Customers** - Companies that buy internet bandwidth/connectivity services
2. **Channel Partner** - Businesses that resell your services to their clients
3. **SOHO/Home** - Small office or home users

### How to Create a New Customer

#### Step 1: Navigate to Customers
- Click on "Customers" in the left sidebar menu

#### Step 2: Click "Add New Customer"
- Look for the blue "+ Add New Customer" button
- Click it to open the customer creation form

#### Step 3: Fill in the Customer Information

**Basic Information:**
- **Customer Name** - The name of your customer (required)
- **Email** - Their email address for communications
- **Phone** - Their contact phone number
- **Address** - Their business address
- **Company Name** - Name of their company

**Service Details:**
- **Customer Type** - Select one of the three types:
  - Bandwidth
  - Channel Partner
  - SOHO/Home

**For Bandwidth & Channel Partner Customers:**
- **Total Clients** - Total number of clients they have
- **Active Clients** - How many of those clients are currently active
- **Previous Total Clients** - Total from previous period (for tracking growth)
- **Free Giveaway Clients** - Number of free clients provided

**For Channel Partner Only:**
- **Default Percentage Share** - The commission percentage they receive

#### Step 4: Assign a Sales Manager (Optional)
- **KAM (Key Account Manager)** - If you have a dedicated person managing this customer, select them

#### Step 5: Set Status
- **Status** - Choose whether the customer is:
  - Active (currently doing business)
  - Inactive (not currently active)

#### Step 6: Save
- Click the "Save" button to create the customer
- You'll see a confirmation message

### How to Edit a Customer

1. Go to the Customers page
2. Find the customer in the list
3. Click the **Edit button** (pencil icon) next to their name
4. Make your changes
5. Click "Save"

### How to Delete a Customer

1. Go to the Customers page
2. Find the customer
3. Click the **Delete button** (trash icon)
4. Confirm the deletion in the popup message

### How to Search Customers

1. Use the search box at the top to search by:
   - Customer name
   - Company name
   - Email
   - Phone number

2. Use the filter options to show:
   - Active or Inactive customers
   - Specific customer types (Bandwidth, Channel Partner, SOHO/Home)

---

## Creating Bill Entries

### What is a Bill Entry?

A bill entry is a record of services provided to a customer for a specific period. It contains all the service details and pricing information that will later be converted into an invoice.

### How to Create a Bill Entry for a Bandwidth Customer

#### Step 1: Navigate to Data Entry
- Click on "Data Entry" in the left sidebar menu

#### Step 2: Click "Create New Bill"
- Look for the blue "+" button or "Create New Bill" button
- This opens the bill creation form

#### Step 3: Select the Customer Type
- Choose **"Bandwidth"** from the customer type dropdown
- This will load all bandwidth customers

#### Step 4: Select the Customer
- Click on the customer dropdown
- Choose the bandwidth customer you want to create a bill for

#### Step 5: Add Service Packages

For Bandwidth customers, you can add multiple service packages. Each package represents a different internet speed/service:

**To Add a Package:**

1. Click "Add Package" button
2. In the new row, fill in:
   - **Package Name** - Select from available bandwidth packages
   - **Start Date** - When the service started (click to pick a date)
   - **Mbps** - Internet speed in Megabits per second (e.g., 10, 20, 50, 100)
   - **Unit Price** - Price per Mbps per month (automatically calculated based on package)
   - **Total** - Total cost (automatically calculated: Mbps × Unit Price)

**To Add Multiple Packages:**
- Click "Add Package" again
- Each package will be on a separate line
- You can add as many packages as needed

**To Remove a Package:**
- Click the **Delete button** (X icon) on that package row
- If it's an existing package, you'll be asked to set an end date (when the service was discontinued)

#### Step 6: Fill in Other Bill Details

**Technical Information:**
- **NTTN Cap** - Network capacity details (if applicable)
- **NTTN Com** - Network communication details (if applicable)
- **Link Source ID** - Identifier for the network link

**Billing Information:**
- **Bill Month** - Select the month for which you're creating the bill
- **Bill Year** - Select the year

**Additional Information:**
- **Notes/Remarks** - Add any additional notes about this bill

#### Step 7: Review and Save

1. Check all the information is correct
2. Look at the **Total Bill Amount** displayed at the bottom
3. Click **"Save Bill"** button
4. You'll see a confirmation message

### Features Available While Creating a Bill Entry

#### 1. **Package Management**
- Add multiple service packages for different services
- Each package shows the calculated total cost
- Remove packages you don't need
- Edit existing packages

#### 2. **Auto-Calculation**
- When you enter Mbps and Unit Price, the Total is automatically calculated
- The overall bill total updates automatically as you add/modify packages

#### 3. **Date Selection**
- Easy calendar picker for start dates
- Month and year selection for billing period
- Clear date format for easy understanding

#### 4. **Package History**
- When editing a bill, you can see existing packages
- Mark packages as removed with an end date (useful for tracking service changes)

#### 5. **Save Draft**
- Your bill is saved as you go
- You can come back and edit it anytime before finalizing

#### 6. **Validation**
- The system checks for required fields
- Shows helpful error messages if something is missing
- Won't let you save incomplete bills

---

## Editing Bill Entries

### How to Edit a Bill Entry

#### Option 1: From the Data Entry List

1. Go to **Data Entry** page
2. Find the bill in the list
3. Click the **Edit button** (pencil icon)
4. The bill form opens with all current information

#### Option 2: From View Details

1. Go to **Data Entry** page
2. Find the bill and click the **View button** (eye icon) to see details
3. Click "Edit" from the details view

### Making Changes to a Bill

Once in edit mode:

#### Modify Package Information
- Click on any package row to edit the details
- Change the Mbps, unit price, or package selection
- The total will update automatically

#### Add New Packages
- Click "Add Package" to add new services
- The new package will be added to the existing ones

#### Remove Packages
- Click the **Delete button** (X icon) on a package row
- If it's an existing package, you'll be asked to set an **End Date** (the date the service ended)
- This is useful for tracking when services were discontinued

#### Update Other Details
- Change any other bill information like notes or remarks
- Update the bill month/year if needed

### Saving Your Changes

1. After making changes, click **"Update Bill"** or **"Save Bill"** button
2. You'll see a confirmation message
3. The bill is now updated with your changes

### Important Notes About Editing

- You can edit a bill anytime before it's finalized into an invoice
- When you remove a package by setting an end date, it doesn't delete the package – it just marks when the service ended
- The bill's total amount will automatically recalculate based on your changes

---

## Generating Invoices

### What is an Invoice?

An invoice is a formal bill sent to customers. It's created from the bill entries you've recorded. An invoice shows:
- Service details
- Pricing
- Total amount due
- Invoice date
- Payment terms

### How to Generate an Invoice

#### Step 1: Navigate to Invoice Creation
- Click on **"Create Invoice"** button in the Invoices section
- Or go to **"Invoices"** page and click the blue **"Create Invoice"** button

#### Step 2: Select Customer Type
- Choose the type of customer:
  - Bandwidth
  - Channel Partner
  - SOHO/Home
- The system filters customers based on type

#### Step 3: Select Customer
- Choose the specific customer from the dropdown
- Only customers with active services will appear

#### Step 4: Select Bill/Entitlement
- Choose which bill/service period you want to invoice
- The system shows available bills for the selected customer

#### Step 5: Set the Invoice Date
- **Invoice Date** - Click to select when you want this invoice dated
- **VAT Rate (Optional)** - If applicable, enter any VAT/Tax percentage
  - Example: Enter "15" for 15% VAT
  - This is optional and can be left blank

#### Step 6: Generate Preview
- Click **"Generate Invoice"** or **"Preview Invoice"**
- The system creates a preview showing exactly what the invoice will look like

#### Step 7: Review and Finalize
- Check all details in the preview:
  - Customer information
  - Service details
  - Amounts and totals
  - Any taxes/VAT
- If everything looks correct, click **"Confirm"** or **"Finalize"**
- If you need to make changes, go back and edit the bill first

### Invoice Functionalities

#### 1. **View Invoice Details**
- See all invoice information on screen
- Review customer details and service descriptions
- Check the complete pricing breakdown

#### 2. **Print Invoice**
- Click the **"Print"** button to print the invoice
- Use your browser's print function (Ctrl+P or Cmd+P)
- Save as PDF for record keeping

#### 3. **Download Invoice**
- Click the **"Download"** button
- Saves the invoice as a PDF file to your computer
- Useful for email or archiving

#### 4. **Track Invoice Status**
Every invoice has a status showing where it is in the payment process:
- **Draft** - Not yet sent to customer
- **Unpaid** - Sent but no payment received
- **Partial** - Customer paid part of the amount
- **Paid** - Fully paid

#### 5. **Mark as Sent**
- Once you send the invoice to the customer, click "Mark as Sent"
- This changes the status from Draft to Unpaid

#### 6. **View Invoice List**
- Go to **"Invoices"** page to see all created invoices
- Search by customer or invoice number
- Filter by status (Draft, Unpaid, Partial, Paid)
- Filter by date range

#### 7. **Search and Filter**
Use these options to find invoices:
- **Customer ID** - Search by customer identifier
- **Customer Type** - Filter by Bandwidth, Channel Partner, or SOHO
- **Status** - Show Draft, Unpaid, Partial, or Paid invoices
- **Date Range** - Filter by start and end dates

#### 8. **Edit Invoice (Before Sending)**
- If the invoice is still in "Draft" status, you can edit it
- Make changes and resave
- Once sent, editing may be restricted (depends on your business rules)

#### 9. **Delete Invoice (Draft Only)**
- Only draft invoices can be deleted
- Once sent, invoices are kept for audit purposes

---

## Making Payments

### What is a Payment?

A payment is when a customer pays for their invoiced services. The system tracks:
- Who paid
- How much they paid
- What invoices were paid
- Payment method used
- Payment date

### How to Record a Payment

#### Step 1: Navigate to Payments
- Click on **"Payments"** in the left sidebar menu
- Click the blue **"Create Payment"** button
- Or click **"Make Payment"** on an invoice

#### Step 2: Select Payment Date
- Choose the date the payment was received
- Defaults to today's date but you can change it
- Click the date field to open a calendar

#### Step 3: Select Customer Type
- Choose the type of customer paying:
  - Bandwidth
  - Channel Partner
  - SOHO/Home
- Only customers of this type will be shown

#### Step 4: Select Customer
- Choose the customer paying from the dropdown
- The system shows active customers

#### Step 5: Select Unpaid Invoices
- The system shows all unpaid invoices for this customer
- **Check the boxes** next to each invoice you're receiving payment for
- You can select one or multiple invoices
- The total amount due for selected invoices is calculated automatically

#### Step 6: Enter Payment Method
- Choose how the customer paid:
  - **Cash** - Physical cash payment
  - **Bkash** - Mobile payment via Bkash
  - **Bank Transfer** - Money transferred from their bank account
  - **Cheque** - Check/cheque payment

#### Step 7: Enter Payment Amount
- **Amount** - Enter how much money was received
- You can pay part or all of an invoice amount
- The system shows if there's any balance remaining

**Example:**
- Invoice total: 10,000 Taka
- Payment received: 5,000 Taka
- Status becomes: "Partial" (partial payment)

#### Step 8: Enter Transaction Reference
- **Transaction ID** - Enter the reference number:
  - For bank transfers: Bank reference number
  - For Bkash: Bkash transaction ID
  - For cash: You can enter a reference number or date
  - For cheque: Cheque number

#### Step 9: Add Remarks (Optional)
- **Remarks/Notes** - Add any additional information:
  - "Payment for April and May bills"
  - "Partial payment, balance due next week"
  - Any other relevant notes

#### Step 10: Save Payment
- Click **"Save Payment"** or **"Record Payment"**
- You'll see a confirmation message
- The invoices' statuses update automatically

### Payment Features

#### 1. **Partial Payments**
- You can record partial payments for invoices
- Enter an amount less than the total due
- The invoice status changes to "Partial"
- The remaining balance is tracked

#### 2. **Multiple Invoice Payments**
- Select multiple unpaid invoices
- Record one payment that covers parts or all of several invoices
- The system allocates the payment across them

#### 3. **Payment Tracking**
- Each payment is recorded with date and method
- Easy to see which customer paid, how much, and when
- Payment methods are clearly labeled

#### 4. **Payment Status**
- **Completed** - Payment successfully recorded
- **Pending** - Payment awaiting confirmation
- **Failed** - Payment issue (very rare)

#### 5. **View Payment History**
- Go to **"Payments"** page to see all payments
- See who paid, how much, what date, and by what method

#### 6. **Search Payments**
Use filters to find specific payments:
- **Customer ID** - Find payments from specific customer
- **Payment Method** - Filter by how payment was made
- **Status** - Show completed, pending, or failed payments
- **Date Range** - Find payments within specific dates
- **Search Field** - Search by transaction ID or invoice number

#### 7. **Payment Receipt**
- A payment receipt is automatically created
- You can view it on the payment details page
- Print or download as needed for records

### Payment Methods Explained

**Cash Payment:**
- Physical money handed over
- Enter "Cash" in transaction ID field
- Note the date received

**Bank Transfer:**
- Customer transfers money from their bank account
- You'll have a bank reference number
- Enter the bank reference as Transaction ID
- Include bank name in remarks if helpful

**Bkash (Mobile Money):**
- Payment via Bkash mobile app
- You'll receive a Bkash transaction ID
- Enter this ID as Transaction ID
- Very quick and easy to track

**Cheque:**
- Payment via physical cheque
- Enter the cheque number as Transaction ID
- Note the bank and clearing details in remarks
- Track when cheque clears

### Best Practices for Recording Payments

1. **Record payments as soon as received** - Don't wait, enter them right away
2. **Keep transaction IDs** - Always save the payment reference number
3. **Match invoices accurately** - Select the correct invoices being paid
4. **Add notes when needed** - Remarks help later if there are questions
5. **Review before saving** - Check amounts and dates are correct

---

## Quick Tips for Success

### General Tips
- ✓ Take your time filling out forms – the system saves as you go
- ✓ Use the search features to find information quickly
- ✓ Check the dashboard regularly for business overview
- ✓ All currency amounts are in Bangladesh Taka (৳)

### Customer Management Tips
- ✓ Keep customer information up to date
- ✓ Assign sales managers (KAM) to important customers
- ✓ Mark customers as inactive if they're no longer active

### Bill Entry Tips
- ✓ Enter bills promptly each month
- ✓ Double-check Mbps and pricing before saving
- ✓ Use the notes field to record any special arrangements

### Invoice Tips
- ✓ Generate invoices before sharing with customers
- ✓ Review the preview carefully for errors
- ✓ Keep a copy for your records
- ✓ Mark invoices as sent when you deliver them

### Payment Tips
- ✓ Record payments on the day received
- ✓ Keep payment proof/receipts
- ✓ Always include transaction reference
- ✓ Check invoice status updates after recording payment

---

## Need Help?

If you encounter any issues:

1. **Check this guide** - Most answers are here
2. **Look for error messages** - The system provides helpful messages
3. **Contact your manager** - For system access or permission questions
4. **Contact IT support** - For technical issues with the application

---

## Summary

You now know how to:
- ✓ View business overview on the Dashboard
- ✓ Create and manage Customers
- ✓ Create and edit Bill Entries for bandwidth services
- ✓ Generate professional Invoices
- ✓ Record Payments received from customers

Start with creating customers, then bill entries, generate invoices, and finally record payments. The system is designed to guide you through each step!

Happy using! 🎉
