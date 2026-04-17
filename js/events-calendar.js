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

    function maxDateKey(leftDateKey, rightDateKey) {
      return leftDateKey > rightDateKey ? leftDateKey : rightDateKey;
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

    function formatListingMonth(monthDate) {
      return monthDate.toLocaleDateString("cs-CZ", {
        month: "long",
        year: "numeric"
      });
    }

    function formatListingDate(dateKey) {
      return parseDateKey(dateKey).toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    try {
      rawEvents = JSON.parse(dataElement.textContent);
    } catch (error) {
      return;
    }

    var today = new Date();
    var currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    var currentMonthKey = toDateKey(currentMonthDate).slice(0, 7);
    var currentMonthStartKey = currentMonthKey + "-01";
    var events = rawEvents
      .filter(function (eventItem) {
        return eventItem && eventItem.date;
      })
      .map(function (eventItem) {
        var eventType = normalizeType(eventItem.type);
        var startDateKey = String(eventItem.date).slice(0, 10);
        var endDateKey = eventItem.end_date ? String(eventItem.end_date).slice(0, 10) : startDateKey;
        var visibleStartDateKey;

        if (endDateKey < startDateKey) {
          endDateKey = startDateKey;
        }

        visibleStartDateKey = maxDateKey(startDateKey, currentMonthStartKey);

        return {
          title: eventItem.title,
          type: eventType,
          startDateKey: startDateKey,
          endDateKey: endDateKey,
          visibleStartDateKey: visibleStartDateKey,
          isCurrentOrFutureMonth: endDateKey >= currentMonthStartKey,
          dateKeys: endDateKey >= currentMonthStartKey ? getDateKeysInRange(visibleStartDateKey, endDateKey) : [],
          monthKeys: endDateKey >= currentMonthStartKey ? getMonthKeysInRange(visibleStartDateKey, endDateKey) : []
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

    var labelElement = root.querySelector("[data-calendar-label]");
    var gridElement = root.querySelector("[data-calendar-grid]");
    var prevButton = root.querySelector("[data-calendar-prev]");
    var nextButton = root.querySelector("[data-calendar-next]");
    var resetButton = root.querySelector("[data-calendar-reset]");
    var listingElement = document.querySelector("[data-events-listing]");
    var listingTitleElement = listingElement
      ? listingElement.querySelector("[data-events-listing-title]")
      : null;
    var eventItemElements = listingElement
      ? Array.prototype.slice.call(listingElement.querySelectorAll("[data-event-item]"))
      : [];
    var emptyStateElement = listingElement ? listingElement.querySelector("[data-events-empty]") : null;
    var eventsByDate = {};
    var monthKeys = [];
    var currentMonthIndex = 0;
    var selectedDateKey = null;
    var filterMode = "all";
    var calendarEvents = events.filter(function (eventItem) {
      return eventItem.isCurrentOrFutureMonth;
    });

    calendarEvents.forEach(function (eventItem) {
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

    if (monthKeys.indexOf(currentMonthKey) === -1) {
      monthKeys.push(currentMonthKey);
    }

    monthKeys.sort();
    currentMonthIndex = monthKeys.indexOf(currentMonthKey);

    if (currentMonthIndex === -1) {
      currentMonthIndex = 0;
    }

    function getMonthDate(monthKey) {
      var parts = monthKey.split("-");

      return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }

    function getMonthEndDateKey(monthKey) {
      var monthDate = getMonthDate(monthKey);
      return toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    }

    function isEventVisibleForMonth(startDateKey, endDateKey, monthKey) {
      var monthStartDateKey = monthKey + "-01";
      var monthEndDateKey = getMonthEndDateKey(monthKey);

      return endDateKey >= monthStartDateKey && startDateKey <= monthEndDateKey;
    }

    function isEventVisibleForCurrentFilter(startDateKey, endDateKey, monthKey) {
      if (endDateKey < currentMonthStartKey) {
        return false;
      }

      if (filterMode === "day" && selectedDateKey) {
        return startDateKey <= selectedDateKey && endDateKey >= selectedDateKey;
      }

      if (filterMode === "month") {
        return isEventVisibleForMonth(startDateKey, endDateKey, monthKey);
      }

      return true;
    }

    function syncListing(monthKey) {
      var visibleItemsCount = 0;

      if (!listingElement) {
        return;
      }

      if (listingTitleElement) {
        if (filterMode === "day" && selectedDateKey) {
          listingTitleElement.textContent = "Akce dne " + formatListingDate(selectedDateKey);
        } else if (filterMode === "month") {
          listingTitleElement.textContent = "Akce pro " + formatListingMonth(getMonthDate(monthKey));
        } else {
          listingTitleElement.textContent = "Všechny akce";
        }
      }

      eventItemElements.forEach(function (eventElement) {
        var startDateKey = eventElement.getAttribute("data-event-start");
        var endDateKey = eventElement.getAttribute("data-event-end");
        var isVisible = isEventVisibleForCurrentFilter(startDateKey, endDateKey, monthKey);

        eventElement.hidden = !isVisible;

        if (isVisible) {
          visibleItemsCount += 1;
        }
      });

      if (emptyStateElement) {
        emptyStateElement.hidden = visibleItemsCount !== 0;
      }
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
        if (selectedDateKey === dateKey && filterMode === "day") {
          selectedDateKey = null;
          filterMode = "month";
        } else {
          selectedDateKey = dateKey;
          filterMode = "day";
        }

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

    function render() {
      var monthKey = monthKeys[currentMonthIndex];
      var monthDate = getMonthDate(monthKey);
      var year = monthDate.getFullYear();
      var month = monthDate.getMonth();
      var firstDayOffset = (monthDate.getDay() + 6) % 7;
      var daysInMonth = new Date(year, month + 1, 0).getDate();

      if (selectedDateKey && selectedDateKey.slice(0, 7) !== monthKey) {
        selectedDateKey = null;

        if (filterMode === "day") {
          filterMode = "month";
        }
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

      syncListing(monthKey);
    }

    prevButton.addEventListener("click", function () {
      if (currentMonthIndex === 0) {
        return;
      }

      currentMonthIndex -= 1;
      selectedDateKey = null;
      filterMode = "month";
      render();
    });

    nextButton.addEventListener("click", function () {
      if (currentMonthIndex >= monthKeys.length - 1) {
        return;
      }

      currentMonthIndex += 1;
      selectedDateKey = null;
      filterMode = "month";
      render();
    });

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        selectedDateKey = null;
        filterMode = "all";
        render();
      });
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupEventsCalendar);
  } else {
    setupEventsCalendar();
  }
})();
