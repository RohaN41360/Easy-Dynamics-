document.getElementById('addRibbonDebug').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;

        if (isDynamicsPage(url)) {
            if (url.includes("ribbondebug=true")) {
                showErrorModal("This page is already in ribbon debug mode.");
            } else {
                const newUrl = url.includes('?') ? `${url}&ribbondebug=true` : `${url}?ribbondebug=true`;
                chrome.tabs.update(tabs[0].id, { url: newUrl });
            }
        } else {
            showErrorModal("This is not an MS Dynamics page.");
        }
    });
});

document.getElementById('advancesetting').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        const entityName = getEntityName(url);
        const entityId = getEntityId(url);
        const webapi = extractMainUrl(url);

        if (isDynamicsPage(url)) {
            if (url.includes("settingsonly=true")) {
                showErrorModal("Current Page is Advance settings.");
            } else {
                const newUrl = `${webapi}/main.aspx?settingsonly=true`;
                chrome.tabs.create({ url: newUrl, index: tabs[0].index + 1 });
            }
        } else {
            showErrorModal("This is not an MS Dynamics page.");
        }
    });
});

document.getElementById('updateRecord').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        const entityName = getEntityName(url);
        const entityId = getEntityId(url);
        const webapi = extractMainUrl(url);

        if (isDynamicsPage(url)) {
            if (entityName == null || entityId == null || webapi == null) {
                showErrorModal("Please open in Entity Record Context");
                return;
            }
            
            document.getElementById('overlay').style.display = 'block';
            document.getElementById('dialog').style.display = 'block';
            resetFields();
        } else {
            showErrorModal("This is not an MS Dynamics page.");
        }
    });
});

// New button for showing the lookup update dialog
document.getElementById('updateLookupFields').addEventListener('click', () => {

    
    // Show the overlay and lookup dialog
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('lookupDialog').style.display = 'block';

    // Dynamically show the input fields for the lookup update
    const lookupFieldsContainer = document.getElementById('lookupFieldsContainer');
    lookupFieldsContainer.innerHTML = `
        <input type="text" id="lookupFieldName" placeholder="Field Name" required/>
        <input type="text" id="lookupEntityName" placeholder="Entity Name" required/>
        <input type="text" id="lookupGuidValue" placeholder="GUID Value" required/>
    `;
});

document.getElementById('closeDialog').addEventListener('click', () => {
    closeDialog();
});

document.getElementById('closeLookupDialog').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('lookupDialog').style.display = 'none';
});

document.getElementById('submitLookupUpdate').addEventListener('click', async () => {
    const fieldName = document.getElementById('lookupFieldName').value.trim();
    const entityName = document.getElementById('lookupEntityName').value.trim();
    const guidValue = document.getElementById('lookupGuidValue').value.trim();

    // Get the button element and change its text to 'Updating...'
    const updateButton = document.querySelector('#updateLookupFields');
    if (updateButton) {
        updateButton.textContent = "Updating...";
        updateButton.disabled = true;  // Optional: disable the button to prevent multiple clicks
    }

    // Validate all fields
    if (fieldName && entityName && guidValue) {
        // Construct the update payload for lookup field using @odata.bind
    
        // Fetch the current active tab to get URL information
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const url = tabs[0].url;
            const entityNameFromUrl = getEntityName(url);  // Assuming getEntityName is a function you have
            const entityId = getEntityId(url);  // Assuming getEntityId is a function you have
            const webapi = extractMainUrl(url);  // Assuming extractMainUrl is a function you have
            
            const baseEntityPluralname = await getEntityPluralName(entityNameFromUrl, webapi);

             // Get the plural name of the entity
            const fieldLookupPluralName = await getEntityPluralName(entityName, webapi);

            const updatePayload = {
                [`${fieldName}@odata.bind`]: `/${fieldLookupPluralName}(${guidValue})`
            };

            if (isDynamicsPage(url)) {
                try {
                    // Update the record using Web API
                    const response = await fetch(`${webapi}/api/data/v9.2/${baseEntityPluralname}(${entityId})`, {
                        method: "PATCH",
                        headers: {
                            "OData-MaxVersion": "4.0",
                            "OData-Version": "4.0",
                            "Content-Type": "application/json; charset=utf-8",
                            "Accept": "application/json",
                            "Prefer": "odata.include-annotations=*"
                        },
                        body: JSON.stringify(updatePayload)
                    });

                    // Handle response
                    if (response.ok) {
                        showSuccessModal("Lookup field updated successfully");
                        chrome.tabs.reload(tabs[0].id);
                    } else {
                        const json = await response.json();
                        showErrorModal("An unknown error occurred : Make sure to the provided details are Correct");
                    }
                } catch (error) {
                    showErrorModal("An error occurred while updating the record: " + error.message);
                } finally {
                    // Revert the button text back to 'Update Lookup' and re-enable it
                    updateButton.textContent = 'Update Lookup';
                    updateButton.disabled = false;
                }
            }
        });

        // Close the dialog
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('lookupDialog').style.display = 'none';
    } else {
        showErrorModal("Please fill in all the fields.");

        // Revert the button text back to 'Update Lookup' and re-enable it if validation fails
        if (updateButton) {
            updateButton.textContent = 'Update Lookup';
            updateButton.disabled = false;
        }
    }
});


function closeDialog() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('dialog').style.display = 'none';
}

function resetFields() {
    const container = document.getElementById('fieldsContainer');
    container.innerHTML = ''; // Clear existing fields
    addField(); // Add one field by default
}

function addField() {
    const container = document.getElementById('fieldsContainer');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    inputGroup.innerHTML = `
        <input type="text" name="fieldName" placeholder="Field Name" required>
        <input type="text" name="fieldValue" placeholder="Field Value" required>
        <button type="button" class="removeField">Remove</button>
    `;
    container.appendChild(inputGroup);

    // Add event listener for the remove button
    inputGroup.querySelector('.removeField').addEventListener('click', () => {
        container.removeChild(inputGroup);
    });
}

function isDynamicsPage(url) {
    return url.includes("dynamics") || (url.includes("crm") && url.includes("ent")) && (url.includes("entityrecord") || url.includes("entitylist"));
}

function getEntityName(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('etn');
}

function getEntityId(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('id');
}

function extractMainUrl(url) {
    const regex = /(https?:\/\/[^\s]+?\.com)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

document.getElementById('updateLookupFields').addEventListener('click', () => {
    // Show the overlay and the lookup dialog
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('lookupDialog').style.display = 'block';
});

document.getElementById('updateRecord').addEventListener('click', () => {
    // Show the overlay and the regular update dialog
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('dialog').style.display = 'block';
});

document.getElementById('closeDialog').addEventListener('click', () => {
    // Close the regular update dialog
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('dialog').style.display = 'none';
});

document.getElementById('closeLookupDialog').addEventListener('click', () => {
    // Close the lookup update dialog
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('lookupDialog').style.display = 'none';
});

// Additional logic for adding fields to dialogs, etc.
document.getElementById('addField').addEventListener('click', () => {
    addFieldToDialog('fieldsContainer');
});

document.getElementById('submitUpdate').addEventListener('click', () => {
    submitRecordUpdate();
});

document.getElementById('submitLookupUpdate').addEventListener('click', () => {
    submitLookupUpdate();
});

function addFieldToDialog(containerId) {
    const container = document.getElementById(containerId);
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';

    inputGroup.innerHTML = `
        <input type="text" name="fieldName" placeholder="Field Name" required>
        <input type="text" name="fieldValue" placeholder="Field Value" required>
        <button type="button" class="removeField">Remove</button>
    `;

    container.appendChild(inputGroup);

    // Add event listener for the remove button
    inputGroup.querySelector('.removeField').addEventListener('click', () => {
        container.removeChild(inputGroup);
    });
}

function submitRecordUpdate() {
    // Handle the submission logic for updating the regular record
    // console.log("Updating Record...");
    closeDialog();
}

function submitLookupUpdate() {
    // Handle the submission logic for updating the lookup field
    // console.log("Updating Lookup Field...");
    closeDialog();
}

function closeDialog() {
    // Hide both the dialog and the overlay
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('dialog').style.display = 'none';
    document.getElementById('lookupDialog').style.display = 'none';
}

document.getElementById('submitUpdate').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        if (isDynamicsPage(url)) {
            const fields = document.querySelectorAll('.input-group');
            let valid = true;
            const records = {};

            fields.forEach(group => {
                const fieldName = group.querySelector('input[name="fieldName"]').value.trim();
                const fieldValue = group.querySelector('input[name="fieldValue"]').value.trim();

                if (fieldName && fieldValue) {
                    records[fieldName] = fieldValue;
                } else {
                    valid = false;
                }
            });

            if (valid) {
                updateRecord(records);
                closeDialog();
            } else {
                showErrorModal("Please fill in all fields.");
            }
        } else {
            showErrorModal("This is not an MS Dynamics page.");
        }
    });
});

function closeDialog() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('dialog').style.display = 'none';
}

function addField() {
    const container = document.getElementById('fieldsContainer');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';

    inputGroup.innerHTML = `
        <input type="text" name="fieldName" placeholder="Field Name" required>
        <input type="text" name="fieldValue" placeholder="Field Value" required>
        <button type="button" class="removeField">Remove</button>
    `;

    container.appendChild(inputGroup);

    // Add event listener for the remove button
    inputGroup.querySelector('.removeField').addEventListener('click', () => {
        container.removeChild(inputGroup);
    });
}

function resetFields() {
    const container = document.getElementById('fieldsContainer');
    container.innerHTML = ''; // Clear existing fields
    addField(); // Add one field by default
}

function updateRecord(records) {
    // Get the button element
    const updateButton = document.querySelector('#updateRecord');
    
    // Change the button text to 'Updating...'
    if (updateButton) {
        updateButton.textContent = "Updating...";
        updateButton.disabled = true;  // Optional: disable the button to prevent multiple clicks
    } else {
        console.error("Button with ID 'updateRecord' not found.");
    }

    // Query active tab in Chrome
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const url = tabs[0].url;
        const entityName = getEntityName(url);
        const entityId = getEntityId(url);
        const webapi = extractMainUrl(url);

        const baseEntityPluralname = await getEntityPluralName(entityName, webapi);

        if (entityName == null || entityId == null || webapi == null) {
            showErrorModal("Please open in Entity Record Context");

            // Revert button text in case of invalid context
            if (updateButton) {
                updateButton.textContent = "Update Record";
                updateButton.disabled = false;  // Re-enable the button
            }
            return;
        }
        
        // Create an array of fetch requests for updating the record
        const promises = Object.keys(records).map(fieldName => {
            const record = {};
            record[fieldName] = records[fieldName];

            return fetch(webapi + `/api/data/v9.2/${baseEntityPluralname}(${entityId})`, {
                method: "PATCH",
                headers: {
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Content-Type": "application/json; charset=utf-8",
                    "Accept": "application/json",
                    "Prefer": "odata.include-annotations=*"
                },
                body: JSON.stringify(record)
            });
        });

        // Wait for all fetch requests to finish
        Promise.all(promises).then(responses => {
            // Process the responses
            let allSuccess = true;

            responses.forEach(response => {
                if (response.ok) {
                    // Handle successful response (optional)
                    console.log("Record successfully updated");
                } else {
                    allSuccess = false;
                    response.json().then(json => {
                        showErrorModal("An unknown error occurred : Make sure to the provided details are Correct");
                        console.log(json.error.message);
                    });
                }
            });

            // Alert user on success or failure
            if (allSuccess) {
                showSuccessModal("Record updated successfully.");
                chrome.tabs.reload(tabs[0].id);  // Optionally reload the page
            } else {
                showErrorModal("There was an error updating the record.");
            }

            // Revert the button text to 'Update Record' and re-enable it
            if (updateButton) {
                updateButton.textContent = "Update Record";
                updateButton.disabled = false;
            }

        }).catch(error => {
            console.log(error.message);

            // Handle any errors that occurred in the fetch process
            showErrorModal("An error occurred while updating the record.");

            // Revert the button text and re-enable it
            if (updateButton) {
                updateButton.textContent = "Update Record";
                updateButton.disabled = false;
            }
        });
    });
}

function changeButtonText(newText) {
    const button = document.querySelector('#updateRecord');
    if (button) {
        button.textContent = newText;
    } else {
        console.error("Button with ID 'updateRecord' not found.");
    }
}

async function getEntityPluralName(entityName, crmUrl) {
    if (!entityName) {
        console.error("Entity name must be provided.");
        return null; // Return null if entity name is not provided
    }

    if (!crmUrl) {
        console.error("CRM URL must be provided.");
        return null; // Return null if CRM URL is not provided
    }

    // Construct the API URL to get the entity metadata
    const apiUrl = `${crmUrl}/api/data/v9.0/EntityDefinitions?$filter=LogicalName eq '${entityName}'`;

    try {
        // Make the GET request to the Dynamics 365 Web API
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Content-Type': 'application/json',
                'Prefer': 'odata.include-annotations="*"'
            }
        });

        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the response JSON
        const data = await response.json();

        // Log the full response to see the structure
        // console.log("Raw API Response:", data); // Log raw data for debugging

        // Check if we have any entities returned
        if (data.value && data.value.length > 0) {
            const entityMetadata = data.value[0];

            // Return the 'PluralName' if it exists, else return null
            return entityMetadata.EntitySetName || null;
        } else {
            console.log("Entity metadata not found.");
            return null; // Return null if entity metadata is not found
        }
    } catch (error) {
        console.error("Error retrieving entity plural name:", error.message);
        return null; // Return null if there was an error during the API request
    }
}

function checkFieldInEntity(entityName, fieldName) {
    // Build the URL to query the entity's attributes metadata
    var metadataUrl = "/api/data/v9.0/EntityDefinitions(LogicalName='" + entityName + "')/Attributes";

    // Send a GET request to the Web API using the Fetch API
    fetch(window.location.origin + metadataUrl, {
        method: "GET", // HTTP method
        headers: {
            "Accept": "application/json", // Expected response format
            "OData-MaxVersion": "4.0", // OData version
            "OData-Version": "4.0"
        }
    })
    .then(response => response.json()) // Parse the JSON response
    .then(data => {
        var fieldExists = false;

        // Loop through attributes and check if the field exists
        data.value.forEach(attribute => {
            if (attribute.LogicalName.toLowerCase() === fieldName.toLowerCase()) {
                fieldExists = true;
                return; // Break the loop if the field is found
            }
        });

        // Display the result to the user
        if (fieldExists) {
            console.log("Field '" + fieldName + "' exists in entity '" + entityName + "'.");
        } else {
            console.log("Field '" + fieldName + "' does not exist in entity '" + entityName + "'.");
        }
    })
    .catch(error => {
        console.error("Error retrieving metadata:", error);
        showErrorModal("An error occurred while retrieving the entity metadata.");
    });
}

// Add these functions at the top of your popup.js file
function showSuccessModal(message) {
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function showErrorModal(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function closeAlertModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}

// Add these event listeners after your other initialization code
document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers for modal OK buttons
    document.getElementById('successModalOk').addEventListener('click', () => {
        closeAlertModal('successModal');
    });

    document.getElementById('errorModalOk').addEventListener('click', () => {
        closeAlertModal('errorModal');
    });
});

// Field Update Modal Functionality
document.getElementById('update').addEventListener('click', async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const url = tabs[0].url;
        if (!isDynamicsPage(url)) {
            showErrorModal("This is not an MS Dynamics page.");
            return;
        }

        const entityName = getEntityName(url);
        const entityId = getEntityId(url);
        const webapi = extractMainUrl(url);

        if (entityName == null || entityId == null || webapi == null) {
            showErrorModal("Please open in Entity Record Context");
            return;
        }

        try {
            // Fetch entity metadata to get fields
            const response = await fetch(`${webapi}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes`, {
                headers: {
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch entity metadata');
            }

            const data = await response.json();
            const fieldSelect = document.getElementById('fieldSelect');
            fieldSelect.innerHTML = '<option value="">Select a field...</option>';
            const inputContainer = document.getElementById('dynamicInputContainer');
            inputContainer.innerHTML = '';
            // Populate field dropdown
            data.value.forEach(attribute => {
                const option = document.createElement('option');
                option.value = attribute.LogicalName;
                option.textContent = attribute.DisplayName?.UserLocalizedLabel?.Label || attribute.LogicalName;
                option.dataset.type = attribute.AttributeType;
                option.dataset.targetEntity = attribute.TargetEntityType;
                fieldSelect.appendChild(option);
            });

            // Show the modal
            document.getElementById('overlay').style.display = 'block';
            document.getElementById('fieldUpdateDialog').style.display = 'block';

            // Add event listener for the submit button
            const submitButton = document.getElementById('submitFieldUpdate');
            if (submitButton) {
                // Remove any existing event listeners
                submitButton.replaceWith(submitButton.cloneNode(true));
                const newSubmitButton = document.getElementById('submitFieldUpdate');
                
                newSubmitButton.addEventListener('click', async function() {
                    const submitButton = this;
                    const originalButtonText = submitButton.textContent;
                    
                    try {
                        const selectedField = fieldSelect.value;
                        const fieldType = fieldSelect.options[fieldSelect.selectedIndex].dataset.type;
                        const targetEntity = fieldSelect.options[fieldSelect.selectedIndex].dataset.targetEntity;
                        const inputContainer = document.getElementById('dynamicInputContainer');
                        let fieldValue;

                        if (!selectedField) {
                            showErrorModal("Please select a field");
                            return;
                        }

                        // Change button text to "Updating..."
                        submitButton.textContent = "Updating...";
                        submitButton.disabled = true;

                        console.log('Updating field:', {
                            entityName,
                            entityId,
                            selectedField,
                            fieldType,
                            targetEntity
                        });

                        const baseEntityPluralname = await getEntityPluralName(entityName, webapi);
                        if (!baseEntityPluralname) {
                            showErrorModal("Could not determine entity plural name");
                            return;
                        }

                        // Get the field value based on field type
                        if (fieldType === 'Lookup') {
                            const select = inputContainer.querySelector('select');
                            fieldValue = select.value;
                            if (!fieldValue) {
                                showErrorModal("Please select a value");
                                return;
                            }
                        } else if (fieldType === 'Picklist') {
                            const select = inputContainer.querySelector('select');
                            fieldValue = parseInt(select.value);
                            if (isNaN(fieldValue)) {
                                showErrorModal("Please select a value");
                                return;
                            }
                        } else if (fieldType === 'Boolean') {
                            const select = inputContainer.querySelector('select');
                            if (!select) {
                                showErrorModal("Please select a value");
                                return;
                            }
                            fieldValue = select.value === 'true';  // Convert string 'true'/'false' to boolean
                            if (typeof fieldValue !== 'boolean') {
                                showErrorModal("Please select a value");
                                return;
                            }
                        } else {
                            const input = inputContainer.querySelector('input');
                            fieldValue = input.value.trim();
                            if (!fieldValue) {
                                showErrorModal("Please enter a value");
                                return;
                            }
                        }

                        // Prepare the update payload
                        const updatePayload = {};
                        if (fieldType === 'Lookup') {
                            if (!targetEntity) {
                                showErrorModal("Target entity information is missing");
                                return;
                            }
                            const targetEntityPluralName = await getEntityPluralName(entityName, webapi);
                            if (!targetEntityPluralName) {
                                showErrorModal("Could not determine target entity plural name");
                                return;
                            }
                            updatePayload[`${selectedField}@odata.bind`] = `/${targetEntityPluralName}(${fieldValue})`;
                        } else {
                            updatePayload[selectedField] = fieldValue;
                        }

                        console.log('Update payload:', updatePayload);

                        // Make the update request
                        const response = await fetch(`${webapi}/api/data/v9.2/${baseEntityPluralname}(${entityId})`, {
                            method: "PATCH",
                            headers: {
                                "OData-MaxVersion": "4.0",
                                "OData-Version": "4.0",
                                "Content-Type": "application/json; charset=utf-8",
                                "Accept": "application/json",
                                "Prefer": "odata.include-annotations=*"
                            },
                            body: JSON.stringify(updatePayload)
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Update error:', errorData);
                            throw new Error(errorData.error?.message || 'Failed to update field');
                        }

                        showSuccessModal("Field updated successfully");
                        document.getElementById('overlay').style.display = 'none';
                        document.getElementById('fieldUpdateDialog').style.display = 'none';
                        chrome.tabs.reload(tabs[0].id);
                    } catch (error) {
                        console.error('Error updating field:', error);
                        showErrorModal("Error updating field: " + error.message);
                    } finally {
                        // Reset button text and state
                        submitButton.textContent = originalButtonText;
                        submitButton.disabled = false;
                    }
                });
            } else {
                console.error('Submit button not found. Make sure you have a button with id="submitFieldUpdate" in your HTML');
            }
        } catch (error) {
            showErrorModal("Error loading fields: " + error.message);
        }
    });
});

// Close field update dialog
document.getElementById('closeFieldUpdateDialog').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('fieldUpdateDialog').style.display = 'none';
});

// Handle field selection change
document.getElementById('fieldSelect').addEventListener('change', async function() {
    const selectedOption = this.options[this.selectedIndex];
    const fieldType = selectedOption.dataset.type;
    const targetEntity = selectedOption.dataset.targetEntity;
    const container = document.getElementById('dynamicInputContainer');
    
    // Clear any existing content
    container.innerHTML = '';

    // If no field is selected, return early
    if (!this.value) {
        return;
    }

    // Show loading state
    container.innerHTML = '<div class="loading">Loading field options...</div>';

    try {
        // Get the current tab's URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tabs[0].url;
        const webapi = extractMainUrl(url);
        const entityName = getEntityName(url);

        if (!webapi || !entityName) {
            throw new Error("Could not determine entity information");
        }

        // Clear loading state
        container.innerHTML = '';

        if (fieldType === 'Picklist') {
            // Fetch option set values
            const response = await fetch(`${webapi}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${this.value}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`, {
                headers: {
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Accept": "application/json"
                }
            });

            if (!response.ok) throw new Error('Failed to fetch option set values');

            const data = await response.json();
            const select = document.createElement('select');
            select.className = 'field-select';
            
            if (data.OptionSet && data.OptionSet.Options) {
                data.OptionSet.Options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.Value;
                    optionElement.textContent = option.Label.UserLocalizedLabel.Label;
                    select.appendChild(optionElement);
                });
            } else {
                throw new Error('No options found in the option set');
            }

            container.appendChild(select);
        } else if (fieldType === 'Boolean') {
            // Handle Yes/No fields
            const select = document.createElement('select');
            select.className = 'field-select';
            
            const yesOption = document.createElement('option');
            yesOption.value = 'true';
            yesOption.textContent = 'Yes';
            
            const noOption = document.createElement('option');
            noOption.value = 'false';
            noOption.textContent = 'No';
            
            select.appendChild(yesOption);
            select.appendChild(noOption);
            
            container.appendChild(select);
        } else if (fieldType === 'Lookup') {
            try {
                console.log('Fetching lookup field metadata for:', this.value);
                // First get the lookup field metadata to get the correct target entity
                const lookupFieldResponse = await fetch(`${webapi}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${this.value}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata`, {
                    headers: {
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                        "Accept": "application/json",
                        "Prefer": "odata.include-annotations=*"
                    }
                });

                if (!lookupFieldResponse.ok) {
                    const errorData = await lookupFieldResponse.json();
                    console.error('Lookup field metadata error:', errorData);
                    throw new Error(`Failed to fetch lookup field metadata: ${errorData.error?.message || lookupFieldResponse.statusText}`);
                }

                const lookupFieldData = await lookupFieldResponse.json();
                console.log('Lookup Field Metadata:', lookupFieldData);

                // Get the target entity from the lookup field metadata
                if (!lookupFieldData.Targets || lookupFieldData.Targets.length === 0) {
                    throw new Error('No target entities found in lookup field metadata');
                }

                const targetEntityName = lookupFieldData.Targets[0];
                console.log('Target Entity Name:', targetEntityName);

                // Get the entity metadata to get the primary field
                const entityMetadataResponse = await fetch(`${webapi}/api/data/v9.2/EntityDefinitions(LogicalName='${targetEntityName}')?$select=PrimaryNameAttribute`, {
                    headers: {
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                        "Accept": "application/json",
                        "Prefer": "odata.include-annotations=*"
                    }
                });

                if (!entityMetadataResponse.ok) {
                    const errorData = await entityMetadataResponse.json();
                    console.error('Entity metadata error:', errorData);
                    throw new Error(`Failed to fetch entity metadata: ${errorData.error?.message || entityMetadataResponse.statusText}`);
                }

                const entityMetadata = await entityMetadataResponse.json();
                console.log('Entity Metadata:', entityMetadata);

                // Get the primary name attribute
                const primaryNameAttribute = entityMetadata.PrimaryNameAttribute;
                if (!primaryNameAttribute) {
                    throw new Error('Could not determine primary name attribute from metadata');
                }

                // Get the plural name using the existing function
                const targetEntityPluralName = await getEntityPluralName(targetEntityName, webapi);
                if (!targetEntityPluralName) {
                    throw new Error('Could not determine entity plural name');
                }

                console.log('Target Entity Plural Name:', targetEntityPluralName);
                console.log('Primary Name Attribute:', primaryNameAttribute);

                // Fetch related entity records using the primary name attribute
                const response = await fetch(`${webapi}/api/data/v9.2/${targetEntityPluralName}?$select=${targetEntityName}id,${primaryNameAttribute}`, {
                    headers: {
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                        "Accept": "application/json",
                        "Prefer": "odata.include-annotations=*"
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Related records error:', errorData);
                    throw new Error(`Failed to fetch related records: ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                console.log('Related Records:', data);

                const select = document.createElement('select');
                select.className = 'field-select';
                
                if (data.value && data.value.length > 0) {
                    data.value.forEach(record => {
                        const option = document.createElement('option');
                        option.value = record[`${targetEntityName}id`];
                        option.textContent = record[primaryNameAttribute];
                        select.appendChild(option);
                    });
                } else {
                    throw new Error('No records found in the related entity');
                }

                container.appendChild(select);
            } catch (error) {
                console.error('Error in lookup field handling:', error);
                showErrorModal("Error loading lookup options: " + error.message);
            }
        } else {
            // For other field types, show a text input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'field-input';
            input.placeholder = 'Enter value...';
            container.appendChild(input);
        }
    } catch (error) {
        showErrorModal("Error loading field options: " + error.message);
    }
});

// Add this CSS to your popup.html file in the style section
const style = document.createElement('style');
style.textContent = `
    .loading {
        padding: 10px;
        color: var(--text-secondary);
        text-align: center;
    }
`;
document.head.appendChild(style);
