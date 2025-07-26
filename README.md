diff --git a/README.md b/README.md
index b2c87cbb00577b474b33eafc9fc133ab834c3712..7b17e7d7b42ac2c55dbb785b7648a8297b3d2356 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,31 @@
 # googleappsscript-crm
 Google Apps Script for CRM
+
+## Configure Spreadsheet ID
+1. Open the Apps Script editor of this project.
+2. Go to **Project Settings** and add a Script Property named `SPREADSHEET_ID` with your spreadsheet ID.
+3. The code reads this value via `PropertiesService.getScriptProperties()` to access the CRM data.
+
+## Deploy as Web App
+1. Click **Deploy > New deployment** in the Apps Script editor.
+2. Choose **Web app** as the deployment type.
+3. Set a description and select the latest version of your code.
+4. Under **Execute as**, choose **Me** and set **Who has access** to **Anyone** (or the desired level).
+5. Confirm to receive the public URL of the CRM.
+
+## Main Project Files
+- **Code.gs** – global configuration, logging and trigger setup.
+- **Server_Data.gs** – CRUD operations and data utilities.
+- **Server_Auth.gs** – user authentication logic.
+- **Server_Actions.gs** – logs calls or email actions from the UI.
+- **Server_Charts.gs** – aggregates statistics for dashboard charts.
+- **Index.html** – main app interface loading other HTML components.
+- **Form.html / EditForm.html** – forms for creating and editing candidates.
+- **DataTable.html** – renders candidate table.
+- **Charts.html** – dashboard charts section.
+- **Login.html** – login page shown before accessing the app.
+- **Style.html / Login_Style.html** – CSS used by the web pages.
+- **MailTemplate.html** – template for confirmation emails.
+
+## Required Permissions
+The script requires authorization to access Google Sheets and to create time‑based triggers (used by `setupTriggers` in `Code.gs`).
