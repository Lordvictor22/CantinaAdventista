const express = require('express');
const router = express.Router();

const {
  getBlockedProducts,
  toggleBlockProduct,
  setStudentLimit,
  linkStudentByEmail,
  getMyStudents
} = require('../controllers/parentController');

router.get('/blocked/:studentId', getBlockedProducts);
router.post('/toggle-block', toggleBlockProduct);
router.post('/student-limit', setStudentLimit);
router.put('/student-limit', setStudentLimit);

router.post('/link', linkStudentByEmail);
router.get('/students', getMyStudents);
module.exports = router;