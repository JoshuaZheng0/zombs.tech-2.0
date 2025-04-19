import tkinter as tk
import json
import random

GRID_SIZE = 100
CELL_SIZE = 6  # pixels

class MapEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Wall Map Editor")

        self.canvas = tk.Canvas(root, width=GRID_SIZE*CELL_SIZE, height=GRID_SIZE*CELL_SIZE, bg='white')
        self.canvas.pack()

        self.map = [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        self.rects = [[None for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

        for x in range(GRID_SIZE):
            for y in range(GRID_SIZE):
                rect = self.canvas.create_rectangle(
                    x*CELL_SIZE, y*CELL_SIZE, (x+1)*CELL_SIZE, (y+1)*CELL_SIZE,
                    fill="white", outline="gray"
                )
                self.rects[x][y] = rect

        self.mode = "wall"  # Possible values: "wall", "tree", "rock", "erase"
        self.sparsity = 0.05  # Default sparsity

        self.canvas.bind("<Button-1>", self.start_drawing)
        self.canvas.bind("<B1-Motion>", self.draw)
        self.root.bind("<s>", self.save_map)

        # Buttons
        self.button_frame = tk.Frame(root)
        self.button_frame.pack()

        self.wall_button = tk.Button(self.button_frame, text="Wall Mode", command=lambda: self.set_mode("wall"))
        self.wall_button.grid(row=0, column=0)

        self.tree_button = tk.Button(self.button_frame, text="Tree Mode", command=lambda: self.set_mode("tree"))
        self.tree_button.grid(row=0, column=1)

        self.rock_button = tk.Button(self.button_frame, text="Rock Mode", command=lambda: self.set_mode("rock"))
        self.rock_button.grid(row=0, column=2)

        self.erase_button = tk.Button(self.button_frame, text="Erase Mode", command=lambda: self.set_mode("erase"))
        self.erase_button.grid(row=0, column=3)

        self.randomize_button = tk.Button(self.button_frame, text="Randomize Trees/Rocks", command=self.randomize_trees_rocks)
        self.randomize_button.grid(row=0, column=4)

        self.sparsity_scale = tk.Scale(self.button_frame, from_=0.01, to=0.5, resolution=0.01,
                                       label="Sparsity", orient=tk.HORIZONTAL, command=self.update_sparsity)
        self.sparsity_scale.set(self.sparsity)
        self.sparsity_scale.grid(row=0, column=5)

        self.clear_button = tk.Button(self.button_frame, text="Clear All", command=self.clear_map)
        self.clear_button.grid(row=0, column=6)

        self.generate_walls_button = tk.Button(self.button_frame, text="Generate Walls", command=self.generate_walls)
        self.generate_walls_button.grid(row=0, column=7)

    def set_mode(self, new_mode):
        self.mode = new_mode
        print(f"Mode set to: {self.mode}")

    def update_sparsity(self, val):
        self.sparsity = float(val)
        print(f"Sparsity set to: {self.sparsity}")

    def start_drawing(self, event):
        self.toggle_cell(event)

    def draw(self, event):
        if 0 <= event.x < GRID_SIZE * CELL_SIZE and 0 <= event.y < GRID_SIZE * CELL_SIZE:
            self.toggle_cell(event)

    def toggle_cell(self, event):
        x = event.x // CELL_SIZE
        y = event.y // CELL_SIZE

        if self.mode == "wall":
            self.map[x][y] = 1
            self.canvas.itemconfig(self.rects[x][y], fill="black")
        elif self.mode == "tree":
            self.map[x][y] = 2
            self.canvas.itemconfig(self.rects[x][y], fill="green")
        elif self.mode == "rock":
            self.map[x][y] = 3
            self.canvas.itemconfig(self.rects[x][y], fill="gray")
        elif self.mode == "erase":
            self.map[x][y] = 0
            self.canvas.itemconfig(self.rects[x][y], fill="white")

    def randomize_trees_rocks(self):
        for x in range(GRID_SIZE):
            for y in range(GRID_SIZE):
                if self.map[x][y] == 0 and random.random() < self.sparsity:
                    type_choice = random.choice([2, 3])  # 2 = tree, 3 = rock
                    self.map[x][y] = type_choice
                    color = "green" if type_choice == 2 else "gray"
                    self.canvas.itemconfig(self.rects[x][y], fill=color)
        print("Randomized trees and rocks.")

    def generate_walls(self):
        # Create walls by filling in random positions with walls (value 1)
        for x in range(GRID_SIZE):
            for y in range(GRID_SIZE):
                if random.random() < 0.3:  # Adjust density of the walls here (30% chance for each cell to be a wall)
                    self.map[x][y] = 1
                    self.canvas.itemconfig(self.rects[x][y], fill="black")
        print("Walls generated randomly.")

    def clear_map(self):
        for x in range(GRID_SIZE):
            for y in range(GRID_SIZE):
                self.map[x][y] = 0
                self.canvas.itemconfig(self.rects[x][y], fill="white")
        print("Map cleared.")

    def save_map(self, event=None):
        with open("wall_map.json", "w") as f:
            json.dump(self.map, f)
        print("Map saved to wall_map.json!")

if __name__ == "__main__":
    root = tk.Tk()
    app = MapEditor(root)
    root.mainloop()
