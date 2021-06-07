'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}, ${this.date
      .getHours()
      .toString()
      .padStart(2, '0')}:${this.date.getMinutes().toString().padStart(2, '0')}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    // this.type = 'cycling'
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km / h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 170);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);

///////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputElements = [
  inputType,
  inputDistance,
  inputDuration,
  inputCadence,
  inputElevation,
];
const deleteAllButton = document.querySelector('.delete-all-workouts');
const sortingMethod = document.querySelector('.sorting-method');
const alertBox = document.querySelector('.error-message');
const gotItBtn = document.querySelector('.got-it-btn');
const formErrorMsg = document.querySelector('.error-message-inline');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #mapEvents = [];
  #workouts = [];
  #markers = [];
  #currentWorkout;
  #currentWorkoutEl;
  #formEdit = false;

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    // sort the elements by date

    this._sortingDelegation();

    // attach event handlers
    form.addEventListener('submit', this._submitForm.bind(this));

    inputType.addEventListener('change', this._toggleElevationFields);

    containerWorkouts.addEventListener(
      'click',
      this._clicksOnWorkOuts.bind(this)
    );

    deleteAllButton.addEventListener('click', this._clearWorkouts.bind(this));

    sortingMethod.addEventListener(
      'change',
      this._sortingDelegation.bind(this)
    );

    gotItBtn.addEventListener('click', function () {
      alertBox.classList.add('removed');
    });

    //close the form by clicking on the ESC button

    document.addEventListener('keydown', this._pressingButtons.bind(this));
  }

  _submitForm(e) {
    this._removeErrorShadowsAndInlineMsg();
    if (this.#formEdit == true) {
      this._updateWorkout(e);
    } else {
      this._newWorkout(e);
      this._sortingDelegation();
    }
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alertBox.classList.remove('removed');
        }
      );
    }
  }
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot//{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  _showForm(mapE) {
    this._toggleElevationFields();
    this.#mapEvent = mapE;

    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // empty the input
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _pressingButtons(e) {
    if (e.key === 'Escape') {
      this._hideForm();
    }
  }

  _toggleElevationFields() {
    if (inputType.value === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    } else {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
    }
    // inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    // inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    // Get the data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if workout is runninng, create running obj
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._addErrorShadows(inputDistance, inputDuration, inputCadence);
        return;
      } else {
        formErrorMsg.classList.add('removed');
        workout = new Running([lat, lng], distance, duration, cadence);
      }
    }

    // if workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._addErrorShadows(inputDistance, inputDuration);
        if (!Number.isFinite(elevation)) {
          formErrorMsg.classList.remove('removed');
          inputElevation.classList.add('form-error');
        }
        return;
      } else {
        workout = new Cycling([lat, lng], distance, duration, elevation);
      }
    }

    // add new obj to the workout array
    this.#workouts.push(workout);

    // add mapE to the mapE array (needed to edit the array)

    this.#mapEvents.push(this.#mapEvent);

    // render workout on a map as a marker

    this._renderWorkoutMarker(workout);

    // render workout on a list
    this._renderWorkout(workout);

    // hide the form + clear input fields
    this._hideForm();

    // set local storage to all workout

    this._setLocalStorage();
    this._removeErrorShadowsAndInlineMsg();
    this.#formEdit = false;
  }

  _addErrorShadows(...inputs) {
    formErrorMsg.classList.remove('removed');
    inputs.forEach(el => {
      let valueEl = +el.value;
      if (!(Number.isFinite(valueEl) && valueEl > 0)) {
        el.classList.add('form-error');
      }
    });
  }

  _removeErrorShadowsAndInlineMsg() {
    formErrorMsg.classList.add('removed');
    inputElements.forEach(el => el.classList.remove('form-error'));
  }
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);
    this.#markers.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 150,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }
  _renderWorkout(workout) {
    let html = this._htmlGenerator(workout);
    form.insertAdjacentHTML('afterend', html);
  }

  _htmlGenerator(workout) {
    let html;
    if (this.#formEdit == true) {
      html = '';
    } else {
      html = `<li class="workout workout--${workout.type}" data-id="${workout.id}">`;
    }

    html =
      html +
      `<h2 class="workout__title"><span class="edit-delete-btn edit-btn"> Edit </span> 
     <span class="edit-delete-btn delete-btn" > Delete </span>${
       workout.description
     }</h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;

    if (workout.type === 'running') {
      html += `<div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence || 0}</span>
      <span class="workout__unit">spm</span>
    </div> 
  `;
    }

    if (workout.type === 'cycling') {
      html += `<div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain || 0}</span>
      <span class="workout__unit">m</span>
    </div>
  `;
    }
    if (this.#formEdit == false) {
      html = html + `</li>`;
    }
    return html;
  }

  _clicksOnWorkOuts(e) {
    const closestWorkout = e.target.closest('.workout');

    if (closestWorkout == null) {
      return;
    }

    this.#currentWorkoutEl = closestWorkout;

    this.#currentWorkout = this.#workouts.find(
      workout => workout.id === this.#currentWorkoutEl.dataset.id
    );

    this.#map.setView(this.#currentWorkout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();

    if (e.target.classList.contains('delete-btn')) {
      this.deleteWorkout(e);
    }
    if (e.target.classList.contains('edit-btn')) {
      this._editWorkout(e);
    }
  }

  _editWorkout(e) {
    // const index = this.#workouts.findIndex(
    //   el => el.id === this.#currentWorkout.id
    // );
    // this.#mapEvent = this.#mapEvents[index];

    e.preventDefault();
    form.classList.remove('hidden');

    if (this.#currentWorkout.type === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    } else {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
    }

    inputType.value = this.#currentWorkout.type;
    inputDistance.value = this.#currentWorkout.distance;
    inputDuration.value = this.#currentWorkout.duration;
    inputCadence.value = this.#currentWorkout.cadence || '0';
    inputElevation.value = this.#currentWorkout.elevationGain || '0';
    this.#formEdit = true;

    // this.#currentWorkoutEl.remove();
    // this.deleteWorkout();
  }

  _updateWorkout(e) {
    e.preventDefault();

    const index = this.#workouts.findIndex(
      el => el.id === this.#currentWorkout.id
    );

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get the data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const cadence = +inputCadence.value;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._addErrorShadows(inputDistance, inputDuration, inputCadence);
        return;
      }

      formErrorMsg.classList.add('removed');
      this.#workouts[index].distance = distance;
      this.#workouts[index].duration = duration;
      this.#workouts[index].cadence = cadence;
      this.#workouts[index].pace = duration / distance;

      workout = this.#workouts[index];

      if (this.#workouts[index].type !== type) {
        workout = new Running(
          [this.#workouts[index].coords[0], this.#workouts[index].coords[1]],
          distance,
          duration,
          cadence
        );
        workout.type = type;
        this.deleteWorkout(e);
        this.#formEdit = false;
        // add new obj to the workout array
        this.#workouts.push(workout);
        // render workout on a list
        this._renderWorkout(workout);
        // hide the form + clear input fields
        this._hideForm();
      }
    }

    // if workout is cycling, update cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert('Inputs have to be positive numbers');
      }

      this.#workouts[index].distance = distance;
      this.#workouts[index].duration = duration;
      this.#workouts[index].speed = distance / (duration / 60);
      this.#workouts[index].elevationGain = elevation;

      workout = this.#workouts[index];

      if (this.#workouts[index].type !== type) {
        workout = new Cycling(
          [this.#workouts[index].coords[0], this.#workouts[index].coords[1]],
          distance,
          duration,
          elevation
        );

        workout.type = type;
        this.deleteWorkout(e);
        this.#formEdit = false;
        // add new obj to the workout array
        this.#workouts.push(workout);
        // render workout on a list
        this._renderWorkout(workout);
        // hide the form + clear input fields
        this._hideForm();
        // sort workout
        this._sortingDelegation();
      }
    }
    // render workout on a list

    this.#currentWorkoutEl.innerHTML = this._htmlGenerator(workout);

    // hide the form + clear input fields
    this._hideForm();
    this.#formEdit = false;

    const marker = L.marker(workout.coords);
    this.#markers.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 150,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    this._deleteMarker(index);

    this._setLocalStorage();
  }

  deleteWorkout(e) {
    // delete workout from the local storage and UI

    const index = this.#workouts.findIndex(
      el => el.id === this.#currentWorkout.id
    );
    this.#workouts.splice(index, 1);
    this.#currentWorkoutEl.remove();

    this._setLocalStorage();
    if (this.#formEdit === false) {
      this._deleteMarker(index);
    }
  }

  _deleteMarker(index) {
    this.#map.removeLayer(this.#markers[index]);
    this.#markers.splice(index, 1);
  }

  _clearWorkouts() {
    this.#workouts = [];
    this._setLocalStorage();
    this._removeAllWorkoutElements();
    this.#markers.forEach(el => this.#map.removeLayer(el));
    this.#markers = [];
  }

  _removeAllWorkoutElements() {
    const listItems = document.querySelectorAll('.workout');
    listItems.forEach(el => el.remove());
  }

  _performSorting() {
    this._setLocalStorage();
    this._removeAllWorkoutElements();
    this._getLocalStorage();
  }
  _sortWorkoutsByDate() {
    console.log(this.#workouts);
    this.#workouts = this.#workouts.sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
  }
  _sortingDelegation() {
    switch (sortingMethod.value) {
      case 'distance':
        this.#workouts = this.#workouts.sort((a, b) => a.distance - b.distance);
        this._performSorting();
        break;
      case 'duration':
        this.#workouts = this.#workouts.sort((a, b) => a.duration - b.duration);
        this._performSorting();
        break;
      case 'type':
        this._sortWorkoutsByDate();

        function compare(a, b) {
          if (a.type < b.type) {
            return -1;
          }
          if (a.type > b.type) {
            return 1;
          }
          return 0;
        }

        this.#workouts = this.#workouts.sort(compare);
        this._performSorting();
        break;
      default:
        this._sortWorkoutsByDate();
        this._performSorting();
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
