// Setup of Datatable
$(document).ready(function () {
  $('#tableData').DataTable({
    paging: false,
    language: {
      info: '_TOTAL_ items',
    },
    order: [[2, 'asc']],
    columnDefs: [
      {
        targets: [0, 1, 5],
        orderable: false,
      },
    ],
  });
});

// Checkbox handling
var checkboxes = document.querySelectorAll('.downloadBulkCheckbox');

Array.prototype.forEach.call(checkboxes, function (cb) {
  cb.addEventListener('change', function () {
    checkedBoxes = document.querySelectorAll(
      'input[type=checkbox]:checked'
    ).length;
    if (checkedBoxes >= 1) {
      document.getElementById('downloadBulkButton').style.display = 'block';
      document.getElementById('bulkDelete').style.display = 'block';
    } else {
      document.getElementById('downloadBulkButton').style.display = 'none';
      document.getElementById('bulkDelete').style.display = 'none';
    }
  });
});

function selectAll() {
  Array.prototype.forEach.call(checkboxes, function (cb) {
    cb.checked = true;
  });
  document.getElementById('downloadBulkButton').style.display = 'block';
  document.getElementById('bulkDelete').style.display = 'block';
}

function selectNone() {
  Array.prototype.forEach.call(checkboxes, function (cb) {
    cb.checked = false;
  });
  document.getElementById('downloadBulkButton').style.display = 'none';
  document.getElementById('bulkDelete').style.display = 'none';
}

var wsURL = '';
location.protocol !== 'https:'
  ? (wsURL = 'ws://' + window.location.host + '/?ws')
  : (wsURL = 'wss://' + window.location.host + '/?ws');
var connection = new WebSocket(wsURL);

connection.onopen = function () {
  console.log('Connected via WebSockets');
};

connection.onclose = function () {
  console.log('Connection has been closed by WebSocket Server');
};

connection.onerror = function (e) {
  console.log('Websocket error: ', e);
};

connection.onmessage = function (m) {
  try {
    var message = JSON.parse(m.data);
    if (message['type'] == 'refreshClipboard') {
      location.reload();
    } else if (message['type'] == 'updateCLI') {
      output = document.getElementById('cliOutput');
      output.innerHTML = message['content'];
      input = document.getElementById('cliCommand');
      input.value = '';
    }
  } catch (e) {
    console.log('Error reading message: ', e);
  }
};

function sendEntry(e) {
  e.preventDefault();
  entryfield = document.getElementById('cbEntry');
  var text = entryfield.value;
  var msg = {
    type: 'newEntry',
    content: text,
  };
  connection.send(JSON.stringify(msg));
  entryfield.value = '';
}

function clearClipboard(e) {
  e.preventDefault;
  result = confirm('Are you sure you want to clear the clipboard?');
  if (result) {
    var msg = {
      type: 'clearClipboard',
      content: '',
    };
    connection.send(JSON.stringify(msg));
  }
}

function delClipboard(id) {
  var msg = {
    type: 'delEntry',
    content: id,
  };
  connection.send(JSON.stringify(msg));
}

function sendCommand(e) {
  e.preventDefault();
  command = document.getElementById('cliCommand');
  var text = command.value;
  var msg = {
    type: 'command',
    content: text,
  };
  connection.send(JSON.stringify(msg));
  command.value == '';
  command.focus();
}

$('#cliCommand').on('keydown', function (e) {
  if (e.which == 13) {
    sendCommand(e);
  }
});

function copyToClipboard(id) {
  let textSelected = document
    .getElementById('card-body-' + id)
    .getElementsByTagName('pre')[0].innerText;

  navigator.clipboard.writeText(textSelected);
}

function deleteFile(path, bulk) {
  let ok;
  !bulk
    ? (ok = confirm('Do you really want to delete the file or directory?'))
    : (ok = true);

  if (ok) {
    var url = '';
    location.protocol !== 'https:'
      ? (url = 'http://' + window.location.host + path + '?delete')
      : (url = 'https://' + window.location.host + path + '?delete');
    var xhttp = new XMLHttpRequest();
    xhttp.open('GET', url, false);
    xhttp.send();
    location.reload();
  }
}

function deleteSharedLink(token) {
  let ok;
  ok = confirm('Do you really want to delete the shared link?');

  if (ok) {
    var url = '';
    location.protocol !== 'https:'
      ? (url = 'http://' + window.location.host + '/' + '?token=' + token)
      : (url = 'https://' + window.location.host + '/' + '?token=' + token);
    var xhttp = new XMLHttpRequest();
    xhttp.open('DELETE', url, false);
    xhttp.send();
    location.reload();
  }
}

function bulkDelete() {
  if (confirm('Do you really want to delete the file or directory?')) {
    // collect all checked checkboxes and do delete the file for each occurance
    $('.downloadBulkCheckbox:checkbox:checked').each(function () {
      var sThisVal = this.checked ? $(this).val() : '';
      deleteFile(decodeURIComponent(sThisVal), true);
    });
  }
}

document
  .getElementById('qrModal')
  .addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget;
    const qrCode = button.getAttribute('data-qrcode');

    const img = document.getElementById('qrImage');
    img.src = qrCode;

    const title = button.getAttribute('data-filename');
    const target = document.getElementById('qrModalLabel');
    target.innerHTML = title;
  });

function toggleLimitInput() {
  const checkbox = document.getElementById('enableLimit');
  const input = document.getElementById('downloadLimit');
  input.disabled = !checkbox.checked;
}

document
  .getElementById('shareModal')
  .addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget;
    const filepath = button.getAttribute('data-file');
    document.getElementById('shareFilePath').value = filepath;

    // Reset modal content on open
    resetModal();
  });

document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.addEventListener('hidden.bs.modal', function () {
      location.reload();
    });
  }
});

function resetModal() {
  // Show form area, hide results
  document.getElementById('shareFormArea').style.display = '';
  document.getElementById('shareResultArea').style.display = 'none';
  document.getElementById('shareModalFooter').style.display = '';
  // Clear inputs
  document.getElementById('expiry').value = 60;
  document.getElementById('enableLimit').checked = false;
  document.getElementById('downloadLimit').value = '';
  document.getElementById('downloadLimit').disabled = true;

  // Clear previous links
  const container = document.getElementById('shareLinksContainer');
  container.innerHTML = '';
}

async function submitShareForm() {
  const filepath = document.getElementById('shareFilePath').value;
  const expireMinutes = parseInt(document.getElementById('expiry').value) || 60;
  const expireSeconds = expireMinutes * 60;
  const limitEnabled = document.getElementById('enableLimit').checked;
  const limitValue = document.getElementById('downloadLimit').value;

  // Build URL with query params
  let url = `${filepath}?share&expires=${expireSeconds}`;
  if (limitEnabled && limitValue) {
    url += `&limit=${encodeURIComponent(limitValue)}`;
  } else {
    url += '&limit=-1';
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const data = await response.json();

    if (!data.urls || data.urls.length === 0) {
      alert('No share URLs returned');
      return;
    }

    // Hide form, footer; show results
    document.getElementById('shareFormArea').style.display = 'none';
    document.getElementById('shareResultArea').style.display = '';
    document.getElementById('shareModalFooter').style.display = 'none';

    const container = document.getElementById('shareLinksContainer');
    container.innerHTML = '';

    // For each URL create a card with the link + QR code
    data.urls.forEach((url) => {
      const card = document.createElement('div');
      card.className =
        'card p-3 customcard d-flex flex-column align-items-start gap-2';

      // Link text & clickable
      const link = document.createElement('a');
      link.className = 'hover-bold-link';
      link.href = url;
      link.target = '_blank';
      link.textContent = url;
      link.style.wordBreak = 'break-word';
      link.style.fontSize = '0.9rem';

      // Create canvas for QR
      const canvas = document.createElement('canvas');
      canvas.style.marginTop = '10px';
      canvas.width = 150;
      canvas.height = 150;

      // Generate QR code on canvas
      new QRious({
        element: canvas,
        value: url,
        size: 150,
      });

      card.appendChild(link);
      card.appendChild(canvas);
      container.appendChild(card);
    });
  } catch (err) {
    alert('Failed to generate share links: ' + err.message);
  }
}
