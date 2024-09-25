const express = require("express");
const app = express();
const port = 3000;
const path = require("path");
const bcrypt = require("bcrypt");
const flash = require("express-flash");
const session = require("express-session");
const hbs = require("hbs");

hbs.registerHelper("eq", function (a, b) {
  return a === b;
});

const { Sequelize } = require("sequelize");
const { Collections, Tasks, Users } = require("./models");

async function someFunction() {
  const collections = await Collections.findAll({
    include: [{ model: Tasks, as: "tasks" }],
  });
}

const config = require("./config/config.json");
const sequelize = new Sequelize(config.development);

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

app.use(express.urlencoded({ extended: true }));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "./views"));

app.use("/assets", express.static(path.join(__dirname, "./assets")));
app.use(
  session({
    name: "my-session",
    secret: "eHNXzdUyXT",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(flash());

app.get("/edit-collection", editCollection);
app.get("/", renderIndex);
app.get("/add-collections", renderCollection);
app.get("/detail/:id", renderDetail);
app.get("/add-task", renderAddTask);
app.get("/register", renderRegister);
app.get("/login", renderLogin);
app.get("/logout", logout);

app.post("/edit-collection", addEdit);
app.post("/delete-collection/:id", deleteOwner);
app.post("/login", addLogin);
app.post("/register", addRegister);
app.post("/add-collections", addCollection);
app.post("/add-task", addTask);
app.post("/update-task/:collectionId/:taskId", updateTask);
app.post("/task-delete/:collectionId/:taskId", deleteTask);
app.post("/completed-task-delete/:collectionId/:taskId", deleteCompletedTask);
app.post("/delete-all-tasks/:collectionId", deleteAllTasks);

async function addRegister(req, res) {
  try {
    const { name, email, password } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await Users.create({
      username: name,
      email: email,
      password: hashedPassword,
    });
    req.flash("success", "Register berhasil!");
    res.redirect("/login");
  } catch (error) {
    req.flash("error", "Nama sudah digunakan!");
    res.redirect("/register");
  }
}

async function addLogin(req, res) {
  try {
    const { email, password } = req.body;

    const user = await Users.findOne({
      where: {
        email: email,
      },
    });

    if (!user) {
      req.flash("error", "Email atau password salah!");
      return res.redirect("/login");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      req.flash("error", "Email atau password salah!");
      return res.redirect("/login");
    }

    req.session.user = {
      id: user.id,
      name: user.username,
      email: user.email,
    };

    req.flash("success", "Berhasil Login");
    res.redirect("/");
  } catch (error) {
    req.flash("error", "Terjadi kesalahan saat login. Silakan coba lagi.");
    res.redirect("/login");
  }
}

async function addCollection(req, res) {
  try {
    if (!req.session.user) {
      return res.status(403).send("Tidak terautentikasi");
    }

    const collection = await Collections.create({
      name: req.body.collection,
      user_id: req.session.user.id,
    });
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error saat menambahkan koleksi");
  }
}

async function editCollection(req, res) {
  const id = req.query.id;
  try {
    const collection = await Collections.findByPk(id);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }
    res.render("edit-collection", { collection });
  } catch (error) {
    res.status(500).send("Error fetching collection");
  }
}

async function addEdit(req, res) {
  const { id, name } = req.body;
  try {
    const collection = await Collections.findByPk(id);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }
    collection.name = name;
    await collection.save();
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error updating collection");
  }
}

async function deleteOwner(req, res) {
  try {
    const collection = await Collections.findByPk(req.params.id);

    if (!collection) {
      return res.status(404).send("Collection not found");
    }

    if (req.session.user.id !== collection.user_id) {
      return res.status(403).send("You are not authorized to delete this collection");
    }

    await collection.destroy();
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error deleting collection");
  }
}

async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/");
    }
    res.redirect("/login");
  });
}

async function addTask(req, res) {
  const collectionId = req.body.collectionId;
  const taskName = req.body.task;

  if (!collectionId) {
    return res.status(400).send("Invalid collectionId");
  }

  try {
    await Tasks.create({
      name: taskName,
      is_done: false,
      collections_id: collectionId,
    });

    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    return res.status(500).send("Error adding task");
  }
}

async function updateTask(req, res) {
  const { collectionId, taskId } = req.params;
  const isDone = req.body.is_done === "on";

  try {
    const taskToUpdate = await Tasks.findByPk(taskId);
    if (taskToUpdate) {
      taskToUpdate.is_done = isDone;
      await taskToUpdate.save();
      return res.redirect(`/detail/${collectionId}`);
    } else {
      return res.status(404).send("Task not found");
    }
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).send("Error updating task");
  }
}

async function deleteTask(req, res) {
  const { collectionId, taskId } = req.params;

  try {
    const deletedCount = await Tasks.destroy({
      where: { id: taskId, collections_id: collectionId, is_done: false },
    });
    if (deletedCount === 0) {
      console.log("Task not found or already completed");
    } else {
      req.flash("success", "Task deleted successfully.");
    }
    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    return res.status(500).send("Error deleting task");
  }
}

async function deleteCompletedTask(req, res) {
  const { collectionId, taskId } = req.params;

  try {
    const deletedCount = await Tasks.destroy({
      where: { id: taskId, collections_id: collectionId, is_done: true },
    });

    if (deletedCount === 0) {
      req.flash("error", "Task not found or already deleted.");
    } else {
      req.flash("success", "Task deleted successfully.");
    }

    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    req.flash("error", "Error deleting completed task.");
  }
}

async function deleteAllTasks(req, res) {
  const { collectionId } = req.params;

  try {
    await Tasks.destroy({ where: { collections_id: collectionId } });
    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    return res.status(500).send("Error deleting all tasks");
  }
}

async function renderRegister(req, res) {
  res.render("register");
}
function renderLogin(req, res) {
  res.render("login");
}

function renderAddTask(req, res) {
  const collectionId = req.query.collectionId;
  res.render("add-task", { collectionId: collectionId });
}

async function renderIndex(req, res) {
  try {
    const collectionsWithTasks = await Collections.findAll({
      include: [{ model: Tasks, as: "tasks", required: false }],
    });

    const collectionsWithTaskCount = collectionsWithTasks.map((collection) => {
      const completedTasks = collection.tasks ? collection.tasks.filter((task) => task.is_done).length : 0;
      return {
        ...collection.toJSON(),
        completedTasks: completedTasks,
        isOwner: req.session.user && req.session.user.id === collection.user_id, // Periksa apakah pengguna adalah pemilik
      };
    });

    res.render("index", { data: collectionsWithTaskCount, user: req.session.user });
  } catch (error) {
    console.error("Error saat mengambil koleksi:", error);
    res.status(500).send("Error saat mengambil koleksi");
  }
}

async function renderDetail(req, res) {
  const id = req.params.id;

  try {
    const collection = await Collections.findByPk(id, {
      include: [
        {
          model: Tasks,
          as: "tasks",
          required: false,
        },
      ],
    });

    if (collection) {
      const completedTasks = collection.tasks ? collection.tasks.filter((task) => task.is_done).length : 0;
      const isOwner = req.session.user && req.session.user.id === collection.user_id; // Cek apakah pengguna adalah pemilik

      res.render("detail", { collection, tasks: collection.tasks, completedTasks, isOwner, user: req.session.user }); // Tambahkan user ke view
    } else {
      res.status(404).send("Collection not found");
    }
  } catch (error) {
    console.error("Error fetching collection details:", error);
    res.status(500).send("Error fetching collection details");
  }
}

function renderCollection(req, res) {
  res.render("add-collections");
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
