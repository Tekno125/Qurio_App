import pool from "../config/database/connection.js";

// ====================================================================
// Helper: Generate kode akses 6 digit acak untuk sesi
// Digunakan siswa untuk join ke sesi
// ====================================================================
function generateAccessCode() {
<<<<<<< HEAD
  const minCode = 100000  // Angka terkecil 6 digit
  const maxCode = 999999  // Angka terbesar 6 digit
  const randomNumber = Math.floor(Math.random() * (maxCode - minCode + 1)) + minCode
  return randomNumber.toString()
=======
  const minCode = 100000; // Angka terkecil 6 digit
  const maxCode = 999999; // Angka terbesar 6 digit
  const randomNumber =
    Math.floor(Math.random() * (maxCode - minCode + 1)) + minCode;
  return randomNumber.toString();
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
}

// ====================================================================
// POST SESSION (Guru membuat sesi baru)
// ====================================================================
export const createSession = async (req, res) => {
<<<<<<< HEAD
  const { title } = req.body

  // Step 1: Ambil ID guru dari token JWT yang sudah diverifikasi
  const teacherId = req.user ? req.user.id : null
=======
  const { title } = req.body;

  // Step 1: Ambil ID guru dari token JWT yang sudah diverifikasi
  const teacherId = req.user ? req.user.id : null;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

  // Step 2: Validasi input dari guru
  if (!title) {
    return res.status(400).json({
      success: false,
<<<<<<< HEAD
      message: "Judul sesi wajib diisi!"
    })
=======
      message: "Judul sesi wajib diisi!",
    });
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
  }

  if (!teacherId) {
    return res.status(401).json({
      success: false,
<<<<<<< HEAD
      message: "Tidak terdeteksi guru pembuat sesi!"
    })
=======
      message: "Tidak terdeteksi guru pembuat sesi!",
    });
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
  }

  try {
    // Step 3: Buat sesi baru di database dengan kode akses acak
    const createdSessionResult = await pool.query(
      "INSERT INTO sessions (title, teacher_id, access_code) VALUES ($1, $2, $3) RETURNING *",
<<<<<<< HEAD
      [title, teacherId, generateAccessCode()]
    )

    const newSession = createdSessionResult.rows[0]

    // Step 4: Broadcast ke WebSocket sehingga guru menerima notifikasi sesi baru
    const io = req.app.get("io")
    if (io) {
      io.to(`teacher:${teacherId}`).emit("session_created", newSession)
    }

    res.status(201).json({ success: true, data: newSession })
  } catch (error) {
    console.error("Create session error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Pembuatan sesi mengalami kegagalan!"
    })
  }
}
=======
      [title, teacherId, generateAccessCode()],
    );

    const newSession = createdSessionResult.rows[0];

    // Step 4: Broadcast ke WebSocket sehingga guru menerima notifikasi sesi baru
    const io = req.app.get("io");
    if (io) {
      io.to(`teacher:${teacherId}`).emit("session_created", newSession);
    }

    res.status(201).json({ success: true, data: newSession });
  } catch (error) {
    console.error("Create session error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Pembuatan sesi mengalami kegagalan!",
    });
  }
};
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

// ====================================================================
// GET SESSIONS (Guru mengambil daftar sesi miliknya)
// ====================================================================
export const getSessions = async (req, res) => {
<<<<<<< HEAD
  const teacher_id = req.user.id
=======
  const teacher_id = req.user.id;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

  // Validasi parameter
  if (!teacher_id) {
    return res.status(400).json({
      success: false,
<<<<<<< HEAD
      message: "Parameter teacher_id wajib diisi!"
    })
=======
      message: "Parameter teacher_id wajib diisi!",
    });
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
  }

  try {
    // Ambil semua sesi milik guru, urutkan dari yang paling baru
    const sessionsResult = await pool.query(
<<<<<<< HEAD
      `
  SELECT
    s.*,
    COUNT(p.id)::int AS participant_count
  FROM sessions s
  LEFT JOIN participants p
    ON p.session_id = s.id
  WHERE s.teacher_id = $1
  GROUP BY s.id
  ORDER BY s.created_at DESC
  `,
      [teacher_id]
    )

    res.status(200).json({ success: true, data: sessionsResult.rows })
  } catch (error) {
    console.error("Get sessions error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!"
    })
  }
}
=======
      "SELECT * FROM sessions WHERE teacher_id = $1 ORDER BY created_at DESC",
      [teacher_id],
    );

    res.status(200).json({ success: true, data: sessionsResult.rows });
  } catch (error) {
    console.error("Get sessions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!",
    });
  }
};
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

// ====================================================================
// GET SESSION (Ambil detail satu sesi spesifik)
// ====================================================================
export const getSession = async (req, res) => {
<<<<<<< HEAD
  const { id } = req.params
=======
  const { id } = req.params;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

  try {
    // Ambil detail sesi berdasarkan ID
    const sessionResult = await pool.query(
      "SELECT * FROM sessions WHERE id = $1",
<<<<<<< HEAD
      [id]
    )
=======
      [id],
    );
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
<<<<<<< HEAD
        message: "Sesi tidak ditemukan!"
      })
    }

    const teacherId = sessionResult.rows[0].teacher_id
    const loggedInTeacherId = req.user ? req.user.id : null
    if (teacherId !== loggedInTeacherId) {
      return res.status(403).json({ success: false, message: "Anda bukan pemilik sesi ini!" })
    }


    res.status(200).json({ success: true, data: sessionResult.rows[0] })
  } catch (error) {
    console.error("Get session error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!"
    })
  }
}

export const getPublicSession = async (req, res) => {
  const { id } = req.params
=======
        message: "Sesi tidak ditemukan!",
      });
    }

    const teacherId = sessionResult.rows[0].teacher_id;
    const loggedInTeacherId = req.user ? req.user.id : null;
    if (teacherId !== loggedInTeacherId) {
      return res
        .status(403)
        .json({ success: false, message: "Anda bukan pemilik sesi ini!" });
    }

    res.status(200).json({ success: true, data: sessionResult.rows[0] });
  } catch (error) {
    console.error("Get session error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!",
    });
  }
};

export const getPublicSession = async (req, res) => {
  const { id } = req.params;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

  try {
    const result = await pool.query(
      "SELECT id, title, access_code, status FROM sessions WHERE id = $1",
<<<<<<< HEAD
      [id]
    )
=======
      [id],
    );
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
<<<<<<< HEAD
        message: "Sesi tidak ditemukan!"
      })
    }

    return res.status(200).json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error("Get public session error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!"
    })
  }
}
=======
        message: "Sesi tidak ditemukan!",
      });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Get public session error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Sesi gagal dimuat!",
    });
  }
};
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

// ====================================================================
// PUT SESSION (Ubah status sesi: active/ended, hanya guru pemilik)
// ====================================================================
export const updateSession = async (req, res) => {
<<<<<<< HEAD
  const { id } = req.params
  const { status } = req.body
=======
  const { id } = req.params;
  const { status } = req.body;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

  try {
    if (status !== "active" && status !== "ended") {
      return res.status(400).json({
        success: false,
<<<<<<< HEAD
        message: "Status sesi harus active atau ended."
      })
=======
        message: "Status sesi harus active atau ended.",
      });
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
    }

    // Cek kepemilikan: hanya guru yang punya sesi ini yang boleh mengubahnya
    const ownerResult = await pool.query(
      "SELECT teacher_id FROM sessions WHERE id = $1",
<<<<<<< HEAD
      [id]
    )
=======
      [id],
    );
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
<<<<<<< HEAD
        message: "Sesi tidak ditemukan!"
      })
=======
        message: "Sesi tidak ditemukan!",
      });
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
    }

    if (ownerResult.rows[0].teacher_id !== req.user?.id) {
      return res.status(403).json({
        success: false,
<<<<<<< HEAD
        message: "Anda bukan pemilik sesi ini!"
      })
    }

    const endedAt = status === "ended" ? new Date() : null
=======
        message: "Anda bukan pemilik sesi ini!",
      });
    }

    const endedAt = status === "ended" ? new Date() : null;
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
    const updatedSessionResult = await pool.query(
      `UPDATE sessions
             SET status = $1,
                 ended_at = $2
             WHERE id = $3
             RETURNING *`,
<<<<<<< HEAD
      [status, endedAt, id]
    )

    const updatedSession = updatedSessionResult.rows[0]

    // Broadcast perubahan status ke WebSocket
    const io = req.app.get("io")
    if (io) {
      io.to(`session:${id}`).emit("session_updated", updatedSession)
      if (status === "ended") {
        io.to(`session:${id}`).emit("session_ended", updatedSession)
      }
    }

    res.status(200).json({ success: true, data: updatedSession })
  } catch (error) {
    console.error("Update session error:", error)
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui status sesi"
    })
  }
}
=======
      [status, endedAt, id],
    );

    const updatedSession = updatedSessionResult.rows[0];

    // Broadcast perubahan status ke WebSocket
    const io = req.app.get("io");
    if (io) {
      io.to(`session:${id}`).emit("session_updated", updatedSession);
      if (status === "ended") {
        io.to(`session:${id}`).emit("session_ended", updatedSession);
      }
    }

    res.status(200).json({ success: true, data: updatedSession });
  } catch (error) {
    console.error("Update session error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui status sesi",
    });
  }
};

// ====================================================================
// DELETE SESSION (Hapus sesi dan data turunannya, hanya guru pemilik)
// ====================================================================
export const deleteSession = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedSessionResult = await pool.query(
      "DELETE FROM sessions WHERE id = $1 AND teacher_id = $2 RETURNING id",
      [id, req.user.id],
    );

    if (deletedSessionResult.rows.length === 0) {
      const sessionResult = await pool.query(
        "SELECT teacher_id FROM sessions WHERE id = $1",
        [id],
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Sesi tidak ditemukan!",
        });
      }

      return res.status(403).json({
        success: false,
        message: "Anda bukan pemilik sesi ini!",
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`session:${id}`).emit("session_deleted", { id });
    }

    return res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    console.error("Delete session error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menghapus sesi",
    });
  }
};
>>>>>>> f926813 (feat: menambahkan endpoint hapus sesi di backend)
