Dashboard

Observations -> 
Create Observations:user can add new observation with date,time,observation category,description,AMC,Informed to,logged by(current user)

View Observations: Table view,ID,Observed Date,Category,descrption,AMC,Informed to,Logged by . On row click,detailed view modal and inside modal option to edit and save
Category tab - > Categories ,with inform to contacts.

2 tabs filter - New Observations,Closed Observations
add a date filter(calandar)


Work Tickets -> 
create a ticket : ticket number - auto generated, assignee, priority,due date,title,description,attachments

view all tickets - admins
view assigned tickets - users
status update - in progress,on hold,in review.. completed only for admins

Checklist -> 
Create Checklist : checklist form ,after filling, click submit.
it will goes to selected users or selected user group

can search previous checklists, can filter by date

Roaster -> 
Create Roaster, validate time and staff repeatition.
display the total duty count per staff from specifiday to day (may 20 2026 - june 20 2026) , give option to choose this range
mark red if staff duty count exeeds 25 days

generate pdf,submit roaster

Attendance - Doubt

Server Details -> 
table view
create ,update,delete
id,rack,host name,ip address,model,serial Num,Admin,Admin Code,OS,Applications,Cluster Type,Indentor,Ph num,Asset Num,Custodian,Redundancy Power,Remarks. = Table fields

Server Service Manuals - list view with download option , upload option for admins and specific roles



give search option (search by admin,rack,ip,admin code)

Requests -> 
table view ,
create,update

create new request -> Name(auto populated),Division(auto populated,but can edit),status (pending,approved,rejected), category (Hardware Replacement,Datacentre Visit,Hardware Request) ,and Purpose, user id(ps...)
status can be only changed by privileges


every tabs and options are populated based on Roles and roles are created with a group of privilages (Only Super user can create and manage them)

Users -> 
create,update,delete,view
Username,Division,pass id,Reporting to,date of join,roles
table view,
view - Details when created , and total experience from here.

Work Logs ->
Card View
date filter for filtering date
only can create the log for the same day,
only can update in that same day
create form contains -> work, description,status(text field), add new work option
update contains edit existing and add new work
admin has user wise filter too

Server Monitoring -> 
Create,Update,Delete,View 
Create -> server ip.
view - table view , fetch server health every 5 seconds
if offline,show the offline servers at the top ,and make sound(alert)

Cluster Details -> 
Create,Update,Delete,View
Create Clustures, Card View, search by clusture option
when clicking a clusture, new page with:-

Tabs -VMs,Nodes,Vcenter,AD

Create VM Details - ip,applications,Node,OS and Expiry,Resource Allotted
Create Nodes - Node,Rack,Host Name,IP Address,Model,Serial No,Admin,Admin Code,OS,Applications,Indentor,Ph Num,Asset num,Custodian,Redundancy Power,Remarks
Create Vcenter - ip address,Name,HDD,RAM,CPU Cores,Vcenter version and type,Licence Expiry,HA Settings,DRS Settings,Storage Settings,Port groups,VM Image Backup Location


VM Requests -> 
Create Request for users and update status for admins and specific roles
Create - Purpose,Admin,OS & Version,IP Address,RAM,CPU,HDD,Type(internet or intranet),date of request(auto populated)

View -> Purpose,Admin,OS & Version,IP Address,RAM,CPU,HDD,Type(internet or intranet),date of request , Remarks(updated by admin),Cluster(Updated by admin while approving),Node(Updated by the admin while approving), Status(Rejected,Pending,Approved)

Update -> on clicking the row, a detailed modal with all details and options for adding admin only fields mentioned above, and a status update button

give a filter button in this page

Inventory -> 
Create - Item name,quantity,description,
View - table view , item name,quantity,description,last updated by and on
Requests - Table View,admins have option to approve or reject
users can view all requests but no action buttons, can show give button only for approved requests and when clicking the give button, a modal with options - to whom, time(auto populated),date (auto populated),by whom(auto populated)

giving something will reflects the inventory list and last updated by field



Roles -> 
only for admin, 
create roles by combining privileges
table view,
create,update,delete

Important Contacts -> Directory,Critical Contacts

