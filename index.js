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
// Pastikan ini sesuai

// Contoh penggunaan
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
// Function untuk menampilkan halaman tambah koleksi

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
app.post("/task-delete/:collectionId/:taskId", deleteTask); // Route for deleting active tasks
app.post("/completed-task-delete/:collectionId/:taskId", deleteCompletedTask); // Route for deleting completed tasks
app.post("/delete-all-tasks/:collectionId", deleteAllTasks); // Route for deleting all tasks

async function addRegister(req, res) {
  try {
    const { name, email, password } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await Users.create({
      // Pastikan 'Users' digunakan di sini
      username: name,
      email: email,
      password: hashedPassword,
    });
    req.flash("success", "Register berhasil!");
    res.redirect("/login");
  } catch (error) {
    encodeURIreq.flash("error", "Nama sudah digunakan!");
    res.redirect("/register");
  }
}

async function addLogin(req, res) {
  try {
    const { email, password } = req.body;

    // Cek email user apakah ada di database
    const user = await Users.findOne({
      where: {
        email: email,
      },
    });

    if (!user) {
      req.flash("error", "Email atau password salah!");
      return res.redirect("/login");
    }

    // Cek password apakah valid dengan password yang sudah di-hash
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      req.flash("error", "Email atau password salah!");
      return res.redirect("/login");
    }

    // Simpan informasi pengguna dalam sesi
    req.session.user = {
      id: user.id,
      name: user.username,
      email: user.email,
    };

    console.log("User logged in:", req.session.user);
    req.flash("success", "Berhasil Login");
    res.redirect("/");
  } catch (error) {
    console.error("Error saat login:", error);
    req.flash("error", "Terjadi kesalahan saat login. Silakan coba lagi.");
    res.redirect("/login");
  }
}

// Function untuk menambahkan koleksi
// Function untuk menambahkan koleksi
async function addCollection(req, res) {
  try {
    if (!req.session.user) {
      return res.status(403).send("Tidak terautentikasi"); // Pastikan pengguna terautentikasi
    }

    const collection = await Collections.create({
      name: req.body.collection,
      user_id: req.session.user.id, // Gunakan ID pengguna yang sedang masuk
    });
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Error saat menambahkan koleksi");
  }
}

async function editCollection(req, res) {
  const id = req.query.id; // Ambil id dari query string
  try {
    const collection = await Collections.findByPk(id);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }
    res.render("edit-collection", { collection }); // Kirim data koleksi ke halaman edit
  } catch (error) {
    res.status(500).send("Error fetching collection");
  }
}

async function addEdit(req, res) {
  const { id, name } = req.body; // Ambil id dan nama dari body
  try {
    const collection = await Collections.findByPk(id);
    if (!collection) {
      return res.status(404).send("Collection not found");
    }
    collection.name = name; // Update nama koleksi
    await collection.save(); // Simpan perubahan
    res.redirect("/"); // Redirect ke halaman utama
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

    // Hanya pemilik koleksi yang boleh menghapusnya
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

async function renderRegister(req, res) {
  res.render("register");
}
function renderLogin(req, res) {
  res.render("login");
}

// Fungsi untuk menghapus semua tugas dalam koleksi
async function deleteAllTasks(req, res) {
  const { collectionId } = req.params;

  try {
    await Tasks.destroy({ where: { collections_id: collectionId } });
    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    console.error("Error deleting all tasks:", error);
    return res.status(500).send("Error deleting all tasks");
  }
}

// Fungsi untuk menghapus tugas aktif
async function deleteTask(req, res) {
  const { collectionId, taskId } = req.params;

  try {
    const deletedCount = await Tasks.destroy({
      where: { id: taskId, collections_id: collectionId, is_done: false },
    });
    if (deletedCount === 0) {
      console.log("Task not found or already completed");
    }
    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    console.error("Error deleting task:", error);
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
      console.log("Completed task not found or already deleted.");
      req.flash("error", "Task not found or already deleted."); // Menambahkan flash message jika tidak ada tugas yang dihapus
    } else {
      req.flash("success", "Task deleted successfully."); // Menambahkan flash message jika tugas dihapus
    }

    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    console.error("Error deleting completed task:", error);
    req.flash("error", "Error deleting completed task.");
    return res.status(500).send("Error deleting completed task");
  }
}

// Fungsi untuk menghapus tugas yang sudah selesai

async function updateTask(req, res) {
  const { collectionId, taskId } = req.params;
  const isDone = req.body.is_done === "on"; // Check if checkbox was checked

  try {
    const taskToUpdate = await Tasks.findByPk(taskId); // Corrected 'task' to 'Tasks'
    if (taskToUpdate) {
      taskToUpdate.is_done = isDone;
      await taskToUpdate.save(); // Save updated task
      return res.redirect(`/detail/${collectionId}`); // Redirect to detail page
    } else {
      return res.status(404).send("Task not found");
    }
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).send("Error updating task");
  }
}

// Function untuk menambahkan task ke dalam koleksi
// Function untuk menambahkan task ke dalam koleksi
async function addTask(req, res) {
  const collectionId = req.body.collectionId;
  const taskName = req.body.task;

  if (!collectionId) {
    return res.status(400).send("Invalid collectionId");
  }

  try {
    await Tasks.create({
      // Ganti 'task' dengan 'Tasks'
      name: taskName,
      is_done: false,
      collections_id: collectionId,
    });

    return res.redirect(`/detail/${collectionId}`);
  } catch (error) {
    console.error("Error adding task:", error);
    return res.status(500).send("Error adding task");
  }
}

// Function untuk menampilkan halaman tambah task
function renderAddTask(req, res) {
  const collectionId = req.query.collectionId; // Ambil collectionId dari query string
  res.render("add-task", { collectionId: collectionId });
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

// Function untuk menampilkan halaman indeks
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

    // Pastikan objek 'user' ditambahkan saat merender
    res.render("index", { data: collectionsWithTaskCount, user: req.session.user });
  } catch (error) {
    console.error("Error saat mengambil koleksi:", error);
    res.status(500).send("Error saat mengambil koleksi");
  }
}

function renderCollection(req, res) {
  res.render("add-collections");
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
