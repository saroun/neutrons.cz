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
    var typeLabels = {
      cna: "CNA",
      school: "Škola",
      conference: "Konference",
      imported: "Import"
    };

    function normalizeType(typeValue) {
      if (typeValue === "cna" || typeValue === "school" || typeValue === "conference" || typeValue === "imported") {
        return typeValue;
      }

      return "conference";
    }

    function parseDateKey(dateKey) {
      var parts = String(dateKey).split("-");

      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    function toDateKey(dateValue) {
      var year = String(dateValue.getFullYear());
      var month = String(dateValue.getMonth() + 1).padStart(2, "0");
      var day = String(dateValue.getDate()).padStart(2, "0");

      return year + "-" + month + "-" + day;
    }

    function getDateKeysInRange(startDateKey, endDateKey) {
      var dateKeys = [];
      var currentDate = parseDateKey(startDateKey);
      var finalDate = parseDateKey(endDateKey);

      while (currentDate <= finalDate) {
        dateKeys.push(toDateKey(currentDate));
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
      }

      return dateKeys;
    }

    function getMonthKeysInRange(startDateKey, endDateKey) {
      var monthKeys = [];
      var currentDate = parseDateKey(startDateKey);
      var finalDate = parseDateKey(endDateKey);
      var currentMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      var finalMonthDate = new Date(finalDate.getFullYear(), finalDate.getMonth(), 1);

      while (currentMonthDate <= finalMonthDate) {
        monthKeys.push(
          currentMonthDate.getFullYear() +
            "-" +
            String(currentMonthDate.getMonth() + 1).padStart(2, "0")
        );

        currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
      }

      return monthKeys;
    }

    function formatMonth(monthDate) {
      var label = monthDate.toLocaleDateString("cs-CZ", {
        month: "long",
        year: "numeric"
      });

      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function formatDate(dateKey) {
      return parseDateKey(dateKey).toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    function formatCompactDate(dateKey) {
      return parseDateKey(dateKey).toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric"
      });
    }

    function formatEventDateRange(eventItem) {
      if (eventItem.startDateKey === eventItem.endDateKey) {
        return formatCompactDate(eventItem.startDateKey);
      }

      return formatCompactDate(eventItem.startDateKey) + " - " + formatCompactDate(eventItem.endDateKey);
    }

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
        var eventType = normalizeType(eventItem.type);
        var startDateKey = String(eventItem.date).slice(0, 10);
        var endDateKey = eventItem.end_date ? String(eventItem.end_date).slice(0, 10) : startDateKey;

        if (endDateKey < startDateKey) {
          endDateKey = startDateKey;
        }

        return {
          title: eventItem.title,
          url: eventItem.url,
          location: eventItem.location,
          type: eventType,
          typeLabel: typeLabels[eventType],
          startDateKey: startDateKey,
          endDateKey: endDateKey,
          dateKeys: getDateKeysInRange(startDateKey, endDateKey),
          monthKeys: getMonthKeysInRange(startDateKey, endDateKey)
        };
      })
      .sort(function (left, right) {
        var byStartDate = left.startDateKey.localeCompare(right.startDateKey);

        if (byStartDate !== 0) {
          return byStartDate;
        }

        var byEndDate = left.endDateKey.localeCompare(right.endDateKey);

        if (byEndDate !== 0) {
          return byEndDate;
        }

        return (left.title || "").localeCompare(right.title || "");
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
    var currentMonthIndex = 0;
    var selectedDateKey = null;

    events.forEach(function (eventItem) {
      eventItem.dateKeys.forEach(function (dateKey) {
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }

        eventsByDate[dateKey].push(eventItem);
      });

      eventItem.monthKeys.forEach(function (monthKey) {
        if (monthKeys.indexOf(monthKey) === -1) {
          monthKeys.push(monthKey);
        }
      });
    });

    monthKeys.sort();

    function getMonthDate(monthKey) {
      var parts = monthKey.split("-");

      return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }

    function createDayCell(dayNumber, dateKey) {
      var dayEvents = eventsByDate[dateKey] || [];
      var uniqueTypes = [];
      var button = document.createElement("button");
      var dayNumberElement = document.createElement("span");

      button.type = "button";
      button.className = "events-day-button";
      dayNumberElement.className = "events-day-number";
      dayNumberElement.textContent = dayNumber;
      button.appendChild(dayNumberElement);

      dayEvents.forEach(function (eventItem) {
        if (uniqueTypes.indexOf(eventItem.type) === -1) {
          uniqueTypes.push(eventItem.type);
        }
      });

      if (dayEvents.length) {
        button.className += " has-events";
        button.className += " event-type-" + uniqueTypes[0];

        var markers = document.createElement("span");
        markers.className = "events-day-markers";

        uniqueTypes.forEach(function (eventType) {
          var marker = document.createElement("span");
          marker.className = "events-day-marker event-type-" + eventType;
          marker.setAttribute("aria-hidden", "true");
          markers.appendChild(marker);
        });

        button.appendChild(markers);
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

    function createDetailItem(eventItem) {
      var listItem = document.createElement("li");
      var header = document.createElement("div");
      var badge = document.createElement("span");
      var link = document.createElement("a");
      var meta = document.createElement("span");
      var metaParts = [formatEventDateRange(eventItem)];

      if (eventItem.location) {
        metaParts.push(eventItem.location);
      }

      listItem.className = "events-calendar-event";
      listItem.className += " event-type-" + eventItem.type;

      header.className = "events-calendar-event-header";
      badge.className = "events-type-badge";
      badge.className += " event-type-" + eventItem.type;
      badge.textContent = eventItem.typeLabel;
      header.appendChild(badge);

      link.href = eventItem.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = eventItem.title;

      meta.className = "events-calendar-event-meta";
      meta.textContent = metaParts.join(" | ");

      listItem.appendChild(header);
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
        return eventItem.monthKeys.indexOf(monthKey) !== -1;
      });
      var showingSelectedDay = Boolean(selectedDateKey);

      detailListElement.innerHTML = "";

      if (showingSelectedDay) {
        detailTitleElement.textContent = "Akce " + formatDate(selectedDateKey);

        if (selectedDayEvents.length) {
          selectedDayEvents.forEach(function (eventItem) {
            detailListElement.appendChild(createDetailItem(eventItem));
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
        detailListElement.appendChild(createDetailItem(eventItem));
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

        gridElement.appendChild(createDayCell(day, dateKey));
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
