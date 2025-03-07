// Add this JavaScript to your dashboard.ejs file

// Column mapping based on your board analysis
const COLUMN_MAPPING = {
  // Personal information
  first_name: 'text_mknryxb5',
  last_name: 'text_mknrw0nx',
  email: 'email_mknrc1cr',
  phone: 'phone_mknrws1e',
  touchpoints: 'numeric_mknr1kvd',
  
  // Event details
  event_type: 'dropdown_mknr6qht',
  event_date: 'date_mknrqypm',
  
  // Lead information
  lead_source: 'dropdown_mknr962p',
  contact_date: 'date_mknrnf3a',
  pricing_shared: 'dropdown_mknrgvr4',
  
  // Partner information
  partner_first: 'text_mknryy2m',
  partner_last: 'text_mknrwkvx',
  
  // Other
  owner: 'multiple_person_mknr3xnr',
  status: 'status',
  
  // Enrollment status - update this with your actual column ID
  enrolled: 'color_mkns5rra' // Replace with your actual column ID
};

// Add a variable to store the current filter
let currentEnrollmentFilter = 'all';

// Function to load Monday.com contacts
async function loadMondayContacts() {
  const boardId = document.getElementById('boardId').value || '8628615937'; // Default to your board ID
  const contactsContainer = document.getElementById('mondayContacts');
  
  contactsContainer.innerHTML = '<div class="loading">Loading contacts...</div>';
  
  try {
    const response = await fetch(`/api/monday/board/${boardId}/items?limit=100`);
    const data = await response.json();
    
    // Check if data is an array (direct items) or has items property
    const contacts = Array.isArray(data) ? data : (data.items || []);
    
    if (contacts.length > 0) {
      // Store contacts in window object for later use
      window.loadedContacts = contacts;
      
      // Update contacts count
      document.getElementById('totalContacts').textContent = contacts.length;
      
      // Store cursor for pagination if needed
      window.nextCursor = data.cursor;
      
      // Apply filter and render contacts
      filterAndRenderContacts();
    } else {
      contactsContainer.innerHTML = '<div class="error">No contacts found</div>';
      document.getElementById('totalContacts').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading Monday contacts:', error);
    contactsContainer.innerHTML = `<div class="error">Error loading contacts: ${error.message}</div>`;
    document.getElementById('totalContacts').textContent = '0';
  }
}

// Function to filter and render contacts
function filterAndRenderContacts() {
  const contacts = window.loadedContacts || [];
  
  if (contacts.length === 0) {
    document.getElementById('mondayContacts').innerHTML = '<div class="error">No contacts found</div>';
    document.getElementById('totalContacts').textContent = '0';
    document.getElementById('filteredContacts').textContent = '0';
    return;
  }
  
  // Filter contacts based on enrollment status
  let filteredContacts = contacts;
  
  if (currentEnrollmentFilter !== 'all') {
    filteredContacts = contacts.filter(contact => {
      const enrolledColumn = contact.column_values.find(col => col.id === COLUMN_MAPPING.enrolled);
      if (!enrolledColumn) return false;
      
      return enrolledColumn.text === currentEnrollmentFilter;
    });
  }
  
  // Update filtered count
  document.getElementById('filteredContacts').textContent = filteredContacts.length;
  
  // Render the filtered contacts
  renderMondayContacts(filteredContacts);
}

// Function to set the enrollment filter
function setEnrollmentFilter(filter) {
  // Update the current filter
  currentEnrollmentFilter = filter;
  
  // Update active button state
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Apply the filter and render
  filterAndRenderContacts();
  
  // Show notification
  showNotification('Filter Applied', `Showing contacts with enrollment status: ${filter === 'all' ? 'All' : filter}`, 'info');
}

// Function to render Monday.com contacts
function renderMondayContacts(contacts) {
  const contactsList = document.getElementById('mondayContacts');
  
  if (!contacts || contacts.length === 0) {
    contactsList.innerHTML = '<p>No contacts found</p>';
    return;
  }
  
  // Create table header
  let html = `
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Event Type</th>
            <th>Event Date</th>
            <th>Lead Source</th>
            <th>Enrolled</th>
            <th>Touchpoints</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Process each contact
  contacts.forEach(contact => {
    // Helper function to get column value
    const getColumnValue = (columnId) => {
      const column = contact.column_values.find(col => col.id === columnId);
      return column ? column.text : '';
    };
    
    // Extract values using the column mapping
    const firstName = getColumnValue(COLUMN_MAPPING.first_name);
    const lastName = getColumnValue(COLUMN_MAPPING.last_name);
    const email = getColumnValue(COLUMN_MAPPING.email);
    const phone = getColumnValue(COLUMN_MAPPING.phone);
    const touchpoints = getColumnValue(COLUMN_MAPPING.touchpoints) || '0';
    const eventType = getColumnValue(COLUMN_MAPPING.event_type);
    const eventDate = getColumnValue(COLUMN_MAPPING.event_date);
    const leadSource = getColumnValue(COLUMN_MAPPING.lead_source);
    const enrolled = getColumnValue(COLUMN_MAPPING.enrolled) || 'No';
    
    // Format name (use item name as fallback)
    const displayName = `${firstName} ${lastName}`.trim() || contact.name;
    
    // Format event date
    const formattedEventDate = eventDate ? new Date(eventDate).toLocaleDateString() : 'Not set';
    
    // Determine enrollment badge color
    let enrolledBadgeClass = 'bg-secondary';
    if (enrolled === 'Yes') {
      enrolledBadgeClass = 'bg-success';
    } else if (enrolled === 'Unsubscribed') {
      enrolledBadgeClass = 'bg-danger';
    } else if (enrolled === 'No') {
      enrolledBadgeClass = 'bg-warning text-dark';
    }
    
    // Add row for this contact
    html += `
      <tr>
        <td>${displayName}</td>
        <td>${email}</td>
        <td>${phone}</td>
        <td>${eventType || 'Not specified'}</td>
        <td>${formattedEventDate}</td>
        <td>${leadSource || 'Not specified'}</td>
        <td><span class="badge ${enrolledBadgeClass}">${enrolled}</span></td>
        <td id="touchpoints-${contact.id}">${touchpoints}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="incrementTouchpoints('${contact.id}', '${COLUMN_MAPPING.touchpoints}')">
            <i class="fas fa-plus"></i> Touchpoint
          </button>
          <button class="btn btn-sm btn-success ms-1" onclick="syncToMailchimp('${contact.id}')">
            <i class="fas fa-sync"></i> Sync
          </button>
          <button class="btn btn-sm btn-info ms-1" onclick="viewContactDetails('${contact.id}')">
            <i class="fas fa-eye"></i> Details
          </button>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  contactsList.innerHTML = html;
}

// Function to increment touchpoints
async function incrementTouchpoints(itemId, columnId) {
  // Find the touchpoints element
  const touchpointsElement = document.getElementById(`touchpoints-${itemId}`);
  
  // Add loading indicator
  if (touchpointsElement) {
    touchpointsElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  }
  
  try {
    const response = await fetch(`/api/monday/item/${itemId}/increment-touchpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ columnId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the touchpoints display
      if (touchpointsElement) {
        touchpointsElement.textContent = data.newValue;
        touchpointsElement.classList.add('bg-success', 'text-white');
        setTimeout(() => {
          touchpointsElement.classList.remove('bg-success', 'text-white');
        }, 2000);
      }
      
      // Show success notification
      showNotification('Success', `Touchpoints updated to ${data.newValue}`, 'success');
    } else {
      // Show error notification
      showNotification('Error', data.error || 'Failed to update touchpoints', 'danger');
      
      // Restore previous value if available
      if (touchpointsElement && touchpointsElement.dataset.previousValue) {
        touchpointsElement.textContent = touchpointsElement.dataset.previousValue;
      } else if (touchpointsElement) {
        touchpointsElement.textContent = 'Error';
      }
    }
  } catch (error) {
    console.error('Error incrementing touchpoints:', error);
    showNotification('Error', `Failed to update touchpoints: ${error.message}`, 'danger');
    
    // Restore previous value if available
    if (touchpointsElement && touchpointsElement.dataset.previousValue) {
      touchpointsElement.textContent = touchpointsElement.dataset.previousValue;
    } else if (touchpointsElement) {
      touchpointsElement.textContent = 'Error';
    }
  }
}

// Function to sync contact to Mailchimp
async function syncToMailchimp(itemId) {
  const row = document.getElementById(`touchpoints-${itemId}`).closest('tr');
  if (row) {
    row.classList.add('table-info');
  }
  
  try {
    const response = await fetch(`/api/sync/contact/${itemId}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Success', `Contact synced to Mailchimp: ${data.email}`, 'success');
      // Refresh touchpoints as they should have been incremented
      const touchpointsElement = document.getElementById(`touchpoints-${itemId}`);
      if (touchpointsElement) {
        // Get the current value and increment it
        const currentValue = parseInt(touchpointsElement.textContent) || 0;
        touchpointsElement.textContent = (currentValue + 1).toString();
        touchpointsElement.classList.add('bg-success', 'text-white');
        setTimeout(() => {
          touchpointsElement.classList.remove('bg-success', 'text-white');
        }, 2000);
      }
    } else {
      showNotification('Error', `Failed to sync contact: ${data.message}`, 'danger');
    }
  } catch (error) {
    console.error('Error syncing contact:', error);
    showNotification('Error', `Failed to sync contact: ${error.message}`, 'danger');
  } finally {
    if (row) {
      row.classList.remove('table-info');
    }
  }
}

// Function to view contact details
function viewContactDetails(itemId) {
  // Find the contact in the loaded data
  const contacts = window.loadedContacts || [];
  const contact = contacts.find(c => c.id === itemId);
  
  if (!contact) {
    console.error('Contact not found:', itemId);
    return;
  }
  
  // Helper function to get column value
  const getColumnValue = (columnId) => {
    const column = contact.column_values.find(col => col.id === columnId);
    return column ? column.text : '';
  };
  
  // Extract all values using the column mapping
  const contactDetails = {
    id: contact.id,
    name: contact.name,
    firstName: getColumnValue(COLUMN_MAPPING.first_name),
    lastName: getColumnValue(COLUMN_MAPPING.last_name),
    email: getColumnValue(COLUMN_MAPPING.email),
    phone: getColumnValue(COLUMN_MAPPING.phone),
    touchpoints: getColumnValue(COLUMN_MAPPING.touchpoints) || '0',
    eventType: getColumnValue(COLUMN_MAPPING.event_type),
    eventDate: getColumnValue(COLUMN_MAPPING.event_date),
    leadSource: getColumnValue(COLUMN_MAPPING.lead_source),
    contactDate: getColumnValue(COLUMN_MAPPING.contact_date),
    pricingShared: getColumnValue(COLUMN_MAPPING.pricing_shared),
    partnerFirst: getColumnValue(COLUMN_MAPPING.partner_first),
    partnerLast: getColumnValue(COLUMN_MAPPING.partner_last),
    owner: getColumnValue(COLUMN_MAPPING.owner),
    status: getColumnValue(COLUMN_MAPPING.status),
    enrolled: getColumnValue(COLUMN_MAPPING.enrolled) || 'No'
  };
  
  // Format dates
  const formattedEventDate = contactDetails.eventDate ? new Date(contactDetails.eventDate).toLocaleDateString() : 'Not set';
  const formattedContactDate = contactDetails.contactDate ? new Date(contactDetails.contactDate).toLocaleDateString() : 'Not set';
  
  // Determine enrollment badge color
  let enrolledBadgeClass = 'bg-secondary';
  if (contactDetails.enrolled === 'Yes') {
    enrolledBadgeClass = 'bg-success';
  } else if (contactDetails.enrolled === 'Unsubscribed') {
    enrolledBadgeClass = 'bg-danger';
  } else if (contactDetails.enrolled === 'No') {
    enrolledBadgeClass = 'bg-warning text-dark';
  }
  
  // Create modal content
  const modalContent = `
    <div class="modal-header">
      <h5 class="modal-title">${contactDetails.firstName} ${contactDetails.lastName}</h5>
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </div>
    <div class="modal-body">
      <div class="row">
        <div class="col-md-6">
          <h6>Personal Information</h6>
          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span>Name:</span>
              <span class="text-primary">${contactDetails.firstName} ${contactDetails.lastName}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Email:</span>
              <span class="text-primary">${contactDetails.email}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Phone:</span>
              <span class="text-primary">${contactDetails.phone}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Touchpoints:</span>
              <span class="text-primary">${contactDetails.touchpoints}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Enrolled:</span>
              <span><span class="badge ${enrolledBadgeClass}">${contactDetails.enrolled}</span></span>
            </li>
          </ul>
          
          <h6>Partner Information</h6>
          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span>Partner Name:</span>
              <span class="text-primary">${contactDetails.partnerFirst} ${contactDetails.partnerLast}</span>
            </li>
          </ul>
        </div>
        
        <div class="col-md-6">
          <h6>Event Information</h6>
          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span>Event Type:</span>
              <span class="text-primary">${contactDetails.eventType || 'Not specified'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Event Date:</span>
              <span class="text-primary">${formattedEventDate}</span>
            </li>
          </ul>
          
          <h6>Lead Information</h6>
          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span>Lead Source:</span>
              <span class="text-primary">${contactDetails.leadSource || 'Not specified'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Contact Date:</span>
              <span class="text-primary">${formattedContactDate}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Pricing Shared:</span>
              <span class="text-primary">${contactDetails.pricingShared || 'No'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Owner:</span>
              <span class="text-primary">${contactDetails.owner || 'Not assigned'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>Status:</span>
              <span class="text-primary">${contactDetails.status || 'Not set'}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-primary" onclick="incrementTouchpoints('${contactDetails.id}', '${COLUMN_MAPPING.touchpoints}')">
        <i class="fas fa-plus"></i> Increment Touchpoint
      </button>
      <button type="button" class="btn btn-success" onclick="syncToMailchimp('${contactDetails.id}')">
        <i class="fas fa-sync"></i> Sync to Mailchimp
      </button>
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    </div>
  `;
  
  // Set modal content and show it
  document.getElementById('contactDetailsModalContent').innerHTML = modalContent;
  const modal = new bootstrap.Modal(document.getElementById('contactDetailsModal'));
  modal.show();
}

// Function to show notification
function showNotification(title, message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    console.error('Toast container not found');
    return;
  }
  
  const toastId = 'toast-' + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header bg-${type} text-white">
        <strong class="me-auto">${title}</strong>
        <small>Just now</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
  toast.show();
  
  // Remove toast after it's hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Load contacts when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadMondayContacts();
  
  // Set up refresh button
  document.getElementById('refreshContacts').addEventListener('click', loadMondayContacts);
  
  // Set up filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setEnrollmentFilter(btn.dataset.filter);
    });
  });
}); 