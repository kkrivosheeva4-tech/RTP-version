# -*- coding: utf-8 -*-
import shutil
import os

css_file = r'c:\Users\Ксения\OneDrive\Desktop\РМК\РАДАР\РТП-версии\3 версия\РТП-3\src\css\RMK.css'
css_dir = os.path.dirname(css_file)

# Backup
backup_file = css_file + '.bak'
shutil.copy2(css_file, backup_file)
print('Backup created')

# Read file
with open(css_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract sections
layout_lines = lines[4:1966]
radar_lines = lines[1966:3392]
modals_lines = lines[3392:5286]
components_lines = lines[5286:]

# Create rmk-layout.css
with open(os.path.join(css_dir, 'rmk-layout.css'), 'w', encoding='utf-8') as f:
    f.write('/* rmk-layout.css - Стили для layout (sidebar, header, main) */\n')
    f.write('@import url(\'rmk-base.css\');\n\n')
    f.writelines(layout_lines)

# Create rmk-radar.css
with open(os.path.join(css_dir, 'rmk-radar.css'), 'w', encoding='utf-8') as f:
    f.write('/* rmk-radar.css - Стили для радара */\n')
    f.write('@import url(\'rmk-base.css\');\n\n')
    f.writelines(radar_lines)

# Create rmk-modals.css
with open(os.path.join(css_dir, 'rmk-modals.css'), 'w', encoding='utf-8') as f:
    f.write('/* rmk-modals.css - Стили для модальных окон */\n')
    f.write('@import url(\'rmk-base.css\');\n\n')
    f.writelines(modals_lines)

# Create rmk-components.css
with open(os.path.join(css_dir, 'rmk-components.css'), 'w', encoding='utf-8') as f:
    f.write('/* rmk-components.css - Стили для компонентов */\n')
    f.write('@import url(\'rmk-base.css\');\n\n')
    f.writelines(components_lines)

# Update RMK.css
with open(css_file, 'w', encoding='utf-8') as f:
    f.write('/* RMK.css - Основной файл стилей радара технологий */\n')
    f.write('/* Импорт модульных файлов */\n\n')
    f.write('@import url(\'rmk-base.css\');\n')
    f.write('@import url(\'rmk-layout.css\');\n')
    f.write('@import url(\'rmk-radar.css\');\n')
    f.write('@import url(\'rmk-modals.css\');\n')
    f.write('@import url(\'rmk-components.css\');\n')

print('Done')
