(function () {
  function setupEventsCalendar() {
    var root = document.querySelector("[data-events-calendar]");
    if (!root) {
      return;
    }

    var dataElement = root.querySelector("[data-events-json]");
    if (!dataElement) {
      return;
    }

    var rawEvents;
    try {
      rawEvents = JSON.parse(dataElement.textContent);
    } catch (error) {
      return;
    }

    var events = rawEvents
      .filter(function (eventItem) {
        return eventItem && eventItem.date;
      })
      .map(function (eventItem) {
        return {
          title: eventItem.title,
          url: eventItem.url,
          location: eventItem.location,
          dateKey: String(eventItem.date).slice(0, 10),
          monthKey: String(eventItem.date).slice(0, 7)
        };
      })
      .sort(function (left, right) {
        return left.dateKey.localeCompare(right.dateKey);
      });

    if (!events.length) {
      return;
    }

    var labelElement = root.querySelector("[data-calendar-label]");
    var gridElement = root.querySelector("[data-calendar-grid]");
    var detailTitleElement = root.querySelector("[data-calendar-detail-title]");
    var detailListElement = root.querySelector("[data-calendar-detail-list]");
    var prevButton = root.querySelector("[data-calendar-prev]");
    var nextButton = root.querySelector("[data-calendar-next]");

    var eventsByDate = {};
    var monthKeys = [];

    events.forEach(function (eventItem) {
      if (!eventsByDate[eventItem.dateKey]) {
        eventsByDate[eventItem.dateKey] = [];
      }
      eventsByDate[eventItem.dateKey].push(eventItem);

      if (monthKeys.indexOf(eventItem.monthKey) === -1) {
        monthKeys.push(eventItem.monthKey);
      }
    });

    var currentMonthIndex = 0;
    var selectedDateKey = null;

    function getMonthDate(monthKey) {
      var parts = monthKey.split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }

    function formatMonth(monthDate) {
      var label = monthDate.toLocaleDateString("cs-CZ", {
        month: "long",
        year: "numeric"
      });

      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function formatDate(dateKey) {
      return new Date(dateKey + "T00:00:00").toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    function formatCompactDate(dateKey) {
      return new Date(dateKey + "T00:00:00").toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric"
      });
    }

    function createDayCell(dayNumber, dateKey, hasEvents) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "events-day-button";
      button.textContent = dayNumber;

      if (hasEvents) {
        button.className += " has-events";
      }

      if (dateKey === selectedDateKey) {
        button.className += " is-selected";
        button.setAttribute("aria-current", "date");
      }

      button.addEventListener("click", function () {
        selectedDateKey = selectedDateKey === dateKey ? null : dateKey;
        render();
      });

      return button;
    }

    function createEmptyCell() {
      var element = document.createElement("span");
      element.className = "events-day-button is-empty";
      element.setAttribute("aria-hidden", "true");
      return element;
    }

    function createDetailItem(eventItem, includeDate) {
      var listItem = document.createElement("li");
      listItem.className = "events-calendar-event";

      var link = document.createElement("a");
      link.href = eventItem.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = eventItem.title;

      var meta = document.createElement("span");
      meta.className = "events-calendar-event-meta";
      meta.textContent = includeDate
        ? formatCompactDate(eventItem.dateKey) + " - " + eventItem.location
        : eventItem.location;

      listItem.appendChild(link);
      listItem.appendChild(meta);

      return listItem;
    }

    function createEmptyDetail(message) {
      var listItem = document.createElement("li");
      listItem.className = "events-calendar-event is-empty";
      listItem.textContent = message;
      return listItem;
    }

    function renderDetails(monthKey) {
      var monthDate = getMonthDate(monthKey);
      var selectedDayEvents = selectedDateKey ? eventsByDate[selectedDateKey] || [] : [];
      var monthEvents = events.filter(function (eventItem) {
        return eventItem.monthKey === monthKey;
      });
      var showingSelectedDay = Boolean(selectedDateKey);

      detailListElement.innerHTML = "";

      if (showingSelectedDay) {
        detailTitleElement.textContent = "Akce " + formatDate(selectedDateKey);

        if (selectedDayEvents.length) {
          selectedDayEvents.forEach(function (eventItem) {
            detailListElement.appendChild(createDetailItem(eventItem, false));
          });
        } else {
          detailListElement.appendChild(
            createEmptyDetail("V tento den zatím není evidovaná žádná akce.")
          );
        }

        return;
      }

      detailTitleElement.textContent = "Akce v měsíci " + formatMonth(monthDate);

      if (!monthEvents.length) {
        detailListElement.appendChild(
          createEmptyDetail("V tomto měsíci zatím není evidovaná žádná akce.")
        );
        return;
      }

      monthEvents.forEach(function (eventItem) {
        detailListElement.appendChild(createDetailItem(eventItem, true));
      });
    }

    function render() {
      var monthKey = monthKeys[currentMonthIndex];
      var monthDate = getMonthDate(monthKey);
      var year = monthDate.getFullYear();
      var month = monthDate.getMonth();
      var firstDayOffset = (monthDate.getDay() + 6) % 7;
      var daysInMonth = new Date(year, month + 1, 0).getDate();

      if (selectedDateKey && selectedDateKey.slice(0, 7) !== monthKey) {
        selectedDateKey = null;
      }

      labelElement.textContent = formatMonth(monthDate);
      prevButton.disabled = currentMonthIndex === 0;
      nextButton.disabled = currentMonthIndex === monthKeys.length - 1;
      gridElement.innerHTML = "";

      for (var emptyIndex = 0; emptyIndex < firstDayOffset; emptyIndex += 1) {
        gridElement.appendChild(createEmptyCell());
      }

      for (var day = 1; day <= daysInMonth; day += 1) {
        var monthNumber = String(month + 1).padStart(2, "0");
        var dayNumber = String(day).padStart(2, "0");
        var dateKey = year + "-" + monthNumber + "-" + dayNumber;
        var hasEvents = Boolean(eventsByDate[dateKey] && eventsByDate[dateKey].length);

        gridElement.appendChild(createDayCell(day, dateKey, hasEvents));
      }

      renderDetails(monthKey);
    }

    prevButton.addEventListener("click", function () {
      if (currentMonthIndex === 0) {
        return;
      }

      currentMonthIndex -= 1;
      selectedDateKey = null;
      render();
    });

    nextButton.addEventListener("click", function () {
      if (currentMonthIndex >= monthKeys.length - 1) {
        return;
      }

      currentMonthIndex += 1;
      selectedDateKey = null;
      render();
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupEventsCalendar);
  } else {
    setupEventsCalendar();
  }
})();
