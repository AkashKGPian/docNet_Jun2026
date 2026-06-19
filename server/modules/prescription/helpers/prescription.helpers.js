/**
 * Normalize medicine payloads from the canvas UI (`name`) or API (`drug`).
 */
function normalizeMedicines(medicines = []) {
  return medicines
    .map((medicine) => ({
      drug: (medicine.drug || medicine.name || '').trim(),
      dose: medicine.dose || '',
      frequency: medicine.frequency || '',
      duration: medicine.duration || '',
      instructions: medicine.instructions || '',
    }))
    .filter((medicine) => medicine.drug);
}

function buildMedicineWordIncrements(medicines = []) {
  const increments = {};

  normalizeMedicines(medicines).forEach((medicine) => {
    increments[`words.${medicine.drug}`] = 1;
  });

  return increments;
}

module.exports = {
  normalizeMedicines,
  buildMedicineWordIncrements,
};
