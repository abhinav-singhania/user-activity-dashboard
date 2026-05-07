const API_BASE = "https://dummyjson.com";
const USERS_URI = "user";
const USER_DATA_TYPE = {
    POSTS: "posts",
    CARTS: "carts",
    TODOS: "todos"
}

const API_CACHE = new Map();

const statusEle = document.querySelector("#status");
const userListEle = document.querySelector("#user-list");

// HELPER
//handles loading, error and default
const setStatus = (status, isError = false) => {
    statusEle.textContent = status;
    statusEle.className = isError ? "status error" : "status";
};

const cleanText = (text) => String(text ?? "").trim();



// API functions
/**
 * Fetches users from the API
 * 
 * @param {number} limit - The number of users to fetch (default is 10)
 * @returns {Promise<Object>} - A promise that resolves to the users data
 * @throws {Error} - Throws an error if the API request fails
 */
const fetchUsers = async (limit) => {
    let response = await fetch(`${API_BASE}/${USERS_URI}?limit=${limit || 10}`);
    if(!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    return response.json();
};

/**
 * Fetches user-specific data (posts, carts, todos) from the API with caching
 * 
 * @param {number} userId - The ID of the user to fetch data for
 * @param {string} type - The type of data to fetch (posts, carts, todos)
 * @returns {Promise<Object>} - A promise that resolves to the user data
 * @throws {Error} - Throws an error if the API request fails
 */
const fetchUserData = async (userId, type) => {
    // returned cached data if present to avoid unnecessary network calls
    if(API_CACHE.has(`${type}-${userId}`)) {
        return API_CACHE.get(`${type}-${userId}`);
    };

    const response = await fetch(`${API_BASE}/${type}/${USERS_URI}/${userId}`);
    if(!response.ok) {
        throw new Error(`Failed to fetch ${type} for user ${userId}: ${response.statusText}`);
        return;
    }

    const responseData = await response.json();
    API_CACHE.set(`${type}-${userId}`, responseData);
    return responseData;
};

/**
 * Fetches both posts and cart data for a user in parallel
 * 
 * @param {number} userId - The ID of the user to fetch data for
 * @returns {Promise<Array>} - A promise that resolves to an array containing posts and cart data
 * @throws {Error} - Throws an error if any of the API requests fail
 */
const fetchUserPostsAndCart = async (userId) => {
    const postsPromise = fetchUserData(userId, USER_DATA_TYPE.POSTS);
    const cartPromise = fetchUserData(userId, USER_DATA_TYPE.CARTS);
    return await Promise.all([postsPromise, cartPromise]);
}



// UI markup functions
const generateErrorMarkup = (message) => {
    return `<div class="status error">${cleanText(message)}</div>`;
}

const generateTodoMarkup = (todo) => {
    return `
    <div class="todo-item">
        <span class="todo-content">${cleanText(todo.todo)}</span>
        ${todo.completed ? 
        "<span class='badge badge-completed'>completed</span>" : 
        "<span class='badge badge-pending'>pending</span>"
        }
    </div>
    `;
}

const generateUserInfoMarkup = (user, posts, cart) => {
    return `
        <span>${user.id}</span>
        <span>${cleanText(user.firstName)} ${cleanText(user.lastName)}</span>
        <span>Posts: ${posts.total}</span>
        <span>Cart Items: ${cart.total}</span>
    `
}



// Accordian UI Generation
const generateAccordianEl = (id, headerInfoTemplate) => {
    let item = document.createElement("div");
    
    const accordianId = `accordian-${id}`;
    item.className = "accordian";
    item.id = accordianId;
    item.setAttribute("data-expanded", "false");

    item.innerHTML = generateAccordianMarkup(id, headerInfoTemplate);

    // attach click listener to header for toggling accordian
    item.querySelector(".accordian-header").addEventListener("click", handleAccordianToggle);
    return item;
}

const generateAccordianMarkup = (id, headerInfoTemplate) => {
    const accordianDetailsId = `details-${id}`;
    return `
        <button class="accordian-header" 
            aria-controls="${accordianDetailsId}"
            aria-expanded="false"
            data-user-id="${id}">
            ${headerInfoTemplate}
            <span class="chevron" aria-hidden="true">V</span>
        </button>
        <div id="${accordianDetailsId}" 
            class="accordion-details-panel" 
            data-expanded="false">
        </div>
    `;
}

const setAccordianExpand = (accordianPanel, buttonPanel, expand) => {
    accordianPanel?.setAttribute("data-expanded", expand.toString());
    buttonPanel?.setAttribute("aria-expanded", expand.toString());
}

// handles accordian click event, fetches and renders details if not already expanded, otherwise collapses the accordian
const handleAccordianToggle = async (event) => {
    const trigger = event.currentTarget;
    const userId = Number.parseInt(trigger.dataset.userId);
    const selectedAccordian = document.querySelector(`#accordian-${userId}`);
    const detailsPanel = document.querySelector(`#details-${userId}`);

    const isExpanded = selectedAccordian.dataset.expanded === "true";

    if(isExpanded) {
        setAccordianExpand(selectedAccordian, trigger, false);
        return;
    }

    setAccordianExpand(selectedAccordian, trigger, true);
    detailsPanel.textContent = "Loading details...";

    try {
        const todos = await fetchUserData(userId, USER_DATA_TYPE.TODOS);
        renderTodos(detailsPanel, todos.todos);
    } catch (error) {
        console.error(`Failed to fetch todos for user ${userId}:`, error);
        detailsPanel.innerHTML = generateErrorMarkup("Error fetching user todos.");
        return;
    }

}


// Rendering data in UI
const renderTodos = (detailsPanel, todos = []) => {
    if(todos.length === 0) {
        detailsPanel.innerHTML = generateErrorMarkup("No todos found for this user.");
        return;
    }
    const todosMarkup = todos.map(todo => {
        return generateTodoMarkup(todo) ;
    }).join("");
    detailsPanel.innerHTML = todosMarkup;
}

const renderUserOneByOne = async(users = []) => {
    userListEle.innerHTML = "";
    for(const user of users) {
        const userId  = user.id;
        try {
            const [posts, cart] = await fetchUserPostsAndCart(userId);
            let userInfoTemplate = generateUserInfoMarkup(user, posts, cart);
            //renders user accordian one by one as data is fetched for better user experience
            let accordianItem = generateAccordianEl(userId, userInfoTemplate);
            userListEle.appendChild(accordianItem);

        } catch (error) {   
            setStatus(`Something went wrong.`, true);
            console.error(`Failed to fetch data for user ${userId}:`, error);
        }
    }
}

// Initialization
const init = async () => {
    setStatus("Loading users..."); 
    try {
        const data = await fetchUsers(10);
        setStatus(`Users: ${data.limit}`);
        renderUserOneByOne(data.users);
    } catch (error) {
        console.error(error);
        setStatus("Error loading users", true);
    }
}

init();