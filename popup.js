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
